-- Canonical baseline migration.
-- Sources:
--   - 20260319010000_push_notification_delivery_pipeline.sql
--   - 20260326183000_push_dispatch_queue_buffering.sql

create extension if not exists pg_net;
create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  app_env text not null default 'production',
  is_active boolean not null default true,
  last_registered_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint push_device_tokens_token_format check (
    expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
  ),
  constraint push_device_tokens_platform_check check (platform in ('android', 'ios')),
  constraint push_device_tokens_app_env_check check (app_env in ('development', 'preview', 'production'))
);
create unique index if not exists idx_push_device_tokens_expo_push_token
  on public.push_device_tokens (expo_push_token);
create index if not exists idx_push_device_tokens_user_active_env
  on public.push_device_tokens (user_id, is_active, app_env);
create table if not exists public.notification_push_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_token_id uuid not null references public.push_device_tokens(id) on delete cascade,
  status text not null default 'pending',
  ticket_id text,
  error_code text,
  error_message text,
  response jsonb,
  attempted_at timestamptz not null default timezone('utc', now()),
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (notification_id, push_token_id),
  constraint notification_push_deliveries_status_check check (
    status in ('pending', 'sent', 'error', 'skipped')
  )
);
create index if not exists idx_notification_push_deliveries_push_token
  on public.notification_push_deliveries (push_token_id);
create table if not exists public.notification_push_dispatch_queue (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default timezone('utc', now()),
  claimed_at timestamptz,
  claim_token uuid,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_push_dispatch_queue_status_check check (
    status in ('failed', 'pending', 'processing')
  )
);
create index if not exists idx_notification_push_dispatch_queue_ready
  on public.notification_push_dispatch_queue (status, available_at, created_at);
create table if not exists public.notification_push_dispatch_wakeup (
  singleton boolean primary key default true,
  last_wake_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_push_dispatch_wakeup_singleton_check check (singleton = true)
);
insert into public.notification_push_dispatch_wakeup (singleton, last_wake_at)
values (true, null)
on conflict (singleton) do nothing;
alter table public.push_device_tokens enable row level security;
alter table public.notification_push_deliveries enable row level security;
alter table public.notification_push_dispatch_queue enable row level security;
alter table public.notification_push_dispatch_wakeup enable row level security;
drop policy if exists "push_device_tokens_no_direct_access" on public.push_device_tokens;
create policy "push_device_tokens_no_direct_access"
on public.push_device_tokens
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
drop policy if exists "notification_push_deliveries_no_direct_access" on public.notification_push_deliveries;
create policy "notification_push_deliveries_no_direct_access"
on public.notification_push_deliveries
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
drop policy if exists "notification_push_dispatch_queue_no_direct_access" on public.notification_push_dispatch_queue;
create policy "notification_push_dispatch_queue_no_direct_access"
on public.notification_push_dispatch_queue
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
drop policy if exists "notification_push_dispatch_wakeup_no_direct_access" on public.notification_push_dispatch_wakeup;
create policy "notification_push_dispatch_wakeup_no_direct_access"
on public.notification_push_dispatch_wakeup
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
drop trigger if exists set_push_device_tokens_updated_at on public.push_device_tokens;
create trigger set_push_device_tokens_updated_at
before update on public.push_device_tokens
for each row execute function public.set_updated_at();
drop trigger if exists set_notification_push_deliveries_updated_at on public.notification_push_deliveries;
create trigger set_notification_push_deliveries_updated_at
before update on public.notification_push_deliveries
for each row execute function public.set_updated_at();
drop trigger if exists set_notification_push_dispatch_queue_updated_at on public.notification_push_dispatch_queue;
create trigger set_notification_push_dispatch_queue_updated_at
before update on public.notification_push_dispatch_queue
for each row execute function public.set_updated_at();
drop trigger if exists set_notification_push_dispatch_wakeup_updated_at on public.notification_push_dispatch_wakeup;
create trigger set_notification_push_dispatch_wakeup_updated_at
before update on public.notification_push_dispatch_wakeup
for each row execute function public.set_updated_at();
create or replace function public.dispatch_notification_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id bigint;
  dispatch_url text := nullif(current_setting('app.push_dispatch_url', true), '');
  dispatch_authorization text := nullif(current_setting('app.push_dispatch_authorization', true), '');
  dispatch_apikey text := nullif(current_setting('app.push_dispatch_apikey', true), '');
  webhook_secret text := coalesce(current_setting('app.push_dispatch_webhook_secret', true), '');
  headers jsonb := jsonb_build_object('Content-Type', 'application/json');
begin
  if new.deleted_at is not null then
    return new;
  end if;

  insert into public.notification_push_dispatch_queue (
    notification_id,
    available_at,
    claim_token,
    claimed_at,
    last_error,
    status
  )
  values (
    new.id,
    timezone('utc', now()),
    null,
    null,
    null,
    'pending'
  )
  on conflict (notification_id) do update
  set
    available_at = least(public.notification_push_dispatch_queue.available_at, timezone('utc', now())),
    claim_token = null,
    claimed_at = null,
    last_error = null,
    status = 'pending';

  update public.notification_push_dispatch_wakeup
  set last_wake_at = timezone('utc', now())
  where singleton = true
    and (
      last_wake_at is null
      or last_wake_at <= timezone('utc', now()) - interval '3 seconds'
    );

  if dispatch_url is null or not found then
    return new;
  end if;

  if dispatch_authorization is not null then
    headers := headers || jsonb_build_object('Authorization', dispatch_authorization);
  end if;

  if dispatch_apikey is not null then
    headers := headers || jsonb_build_object('apikey', dispatch_apikey);
  end if;

  if webhook_secret <> '' then
    headers := headers || jsonb_build_object('x-webhook-secret', webhook_secret);
  end if;

  select net.http_post(
    url := dispatch_url,
    headers := headers,
    body := jsonb_build_object('drain', true, 'notificationId', new.id),
    timeout_milliseconds := 1500
  )
  into request_id;

  return new;
exception
  when others then
    raise log 'dispatch_notification_push_webhook failed for notification %: %', new.id, sqlerrm;
    return new;
end;
$$;
create or replace function public.claim_notification_push_deliveries(
  p_notification_id uuid,
  p_push_token_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_ids uuid[] := '{}'::uuid[];
begin
  if p_notification_id is null or coalesce(array_length(p_push_token_ids, 1), 0) = 0 then
    return claimed_ids;
  end if;

  with claimed as (
    insert into public.notification_push_deliveries (
      notification_id,
      push_token_id,
      attempted_at,
      delivered_at,
      error_code,
      error_message,
      response,
      status,
      ticket_id
    )
    select
      p_notification_id,
      token_id,
      timezone('utc', now()),
      null,
      null,
      null,
      null,
      'pending',
      null
    from unnest(p_push_token_ids) as token_id
    on conflict (notification_id, push_token_id) do update
    set attempted_at = excluded.attempted_at,
        delivered_at = null,
        error_code = null,
        error_message = null,
        response = null,
        status = 'pending',
        ticket_id = null
    where public.notification_push_deliveries.status <> 'sent'
    returning push_token_id
  )
  select coalesce(array_agg(push_token_id), '{}'::uuid[])
  into claimed_ids
  from claimed;

  return claimed_ids;
end;
$$;
create or replace function public.claim_notification_push_dispatch_batch(
  p_limit integer default 24,
  p_claim_token uuid default null,
  p_lease_seconds integer default 90
)
returns table(notification_id uuid, attempt_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_claim_token uuid := coalesce(p_claim_token, gen_random_uuid());
  normalized_limit integer := greatest(least(coalesce(p_limit, 24), 50), 1);
  normalized_lease interval := make_interval(secs => greatest(coalesce(p_lease_seconds, 90), 15));
begin
  return query
  with ready as (
    select
      q.notification_id,
      q.attempt_count
    from public.notification_push_dispatch_queue q
    where (
      q.status = 'pending'
      and q.available_at <= timezone('utc', now())
    ) or (
      q.status = 'processing'
      and q.claimed_at <= timezone('utc', now()) - normalized_lease
    )
    order by q.available_at asc, q.created_at asc
    limit normalized_limit
    for update skip locked
  ),
  claimed as (
    update public.notification_push_dispatch_queue q
    set
      claimed_at = timezone('utc', now()),
      claim_token = normalized_claim_token,
      last_error = null,
      status = 'processing'
    from ready
    where q.notification_id = ready.notification_id
    returning q.notification_id, q.attempt_count
  )
  select claimed.notification_id, claimed.attempt_count
  from claimed;
end;
$$;
drop trigger if exists dispatch_notification_push_after_insert on public.notifications;
create trigger dispatch_notification_push_after_insert
after insert on public.notifications
for each row execute function public.dispatch_notification_push_webhook();
revoke all on function public.claim_notification_push_deliveries(uuid, uuid[]) from public;
grant execute on function public.claim_notification_push_deliveries(uuid, uuid[]) to service_role;
revoke all on function public.claim_notification_push_dispatch_batch(integer, uuid, integer) from public;
grant execute on function public.claim_notification_push_dispatch_batch(integer, uuid, integer) to service_role;
