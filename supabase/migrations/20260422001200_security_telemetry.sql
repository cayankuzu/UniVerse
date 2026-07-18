-- Canonical baseline migration.
-- Sources:
--   - 20260307230000_client_telemetry.sql
--   - 20260312130000_updated_by_audit_automation.sql
--   - 20260314162000_harden_public_projection_views_and_kv_rls.sql
--   - 20260326110000_server_rate_limits_and_reports_hardening.sql
--   - 20260326140000_security_audit_and_detection.sql

create table if not exists public.client_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category text not null,
  event_name text not null,
  status text,
  screen_key text,
  path text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists client_telemetry_events_created_at_idx
  on public.client_telemetry_events (created_at desc);
create index if not exists client_telemetry_events_category_created_at_idx
  on public.client_telemetry_events (category, created_at desc);
create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  ip_address text,
  result text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_audit_logs_created_at_idx
  on public.security_audit_logs (created_at desc);
create index if not exists security_audit_logs_user_id_created_at_idx
  on public.security_audit_logs (user_id, created_at desc);
create index if not exists security_audit_logs_action_created_at_idx
  on public.security_audit_logs (action, created_at desc);
create index if not exists security_audit_logs_resource_idx
  on public.security_audit_logs (resource_type, resource_id, created_at desc);
create table if not exists public.security_detection_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null,
  severity text not null,
  subject_key text not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null default '',
  resource_id text not null default '',
  ip_address text not null default '',
  result text not null default '',
  event_count integer not null default 1,
  window_bucket timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_detection_signals_event_count_check check (event_count >= 1)
);
create unique index if not exists security_detection_signals_dedupe_idx
  on public.security_detection_signals (
    signal_type,
    action,
    subject_key,
    resource_type,
    resource_id,
    window_bucket
  );
create index if not exists security_detection_signals_created_at_idx
  on public.security_detection_signals (created_at desc);
create index if not exists security_detection_signals_severity_created_at_idx
  on public.security_detection_signals (severity, created_at desc);
create table if not exists public.server_rate_limits (
  scope text not null,
  subject text not null,
  bucket_start timestamptz not null,
  count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (scope, subject, bucket_start),
  constraint server_rate_limits_scope_len check (char_length(scope) between 1 and 120),
  constraint server_rate_limits_subject_len check (char_length(subject) between 1 and 240),
  constraint server_rate_limits_count_nonnegative check (count >= 0)
);
create index if not exists idx_server_rate_limits_expires_at
  on public.server_rate_limits (expires_at);
alter table public.client_telemetry_events enable row level security;
alter table public.security_audit_logs enable row level security;
alter table public.security_detection_signals enable row level security;
alter table public.server_rate_limits enable row level security;
alter table public.kv_store_e3557d40 enable row level security;
drop policy if exists "client_telemetry_events_no_direct_access" on public.client_telemetry_events;
create policy "client_telemetry_events_no_direct_access"
on public.client_telemetry_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
drop policy if exists "security_audit_logs_no_direct_access" on public.security_audit_logs;
create policy "security_audit_logs_no_direct_access"
on public.security_audit_logs
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
drop policy if exists "security_detection_signals_no_direct_access" on public.security_detection_signals;
create policy "security_detection_signals_no_direct_access"
on public.security_detection_signals
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
drop policy if exists "server_rate_limits_no_client_access" on public.server_rate_limits;
create policy "server_rate_limits_no_client_access"
on public.server_rate_limits
for all
using (false)
with check (false);
drop policy if exists "kv_store_e3557d40_no_direct_access" on public.kv_store_e3557d40;
create policy "kv_store_e3557d40_no_direct_access"
on public.kv_store_e3557d40
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
create index if not exists profiles_updated_by_idx
  on public.profiles (updated_by);
create index if not exists events_updated_by_idx
  on public.events (updated_by);
create or replace function public.set_owned_record_updated_by()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner_column text := nullif(tg_argv[0], '');
  owner_id uuid := case
    when owner_column is null then null
    else nullif(to_jsonb(new) ->> owner_column, '')::uuid
  end;
  prior_updated_by uuid := case
    when tg_op = 'UPDATE' then old.updated_by
    else null
  end;
begin
  new.updated_by := coalesce(auth.uid(), owner_id, prior_updated_by);
  return new;
end;
$$;
create or replace function public.consume_server_rate_limit(
  target_scope text,
  target_subject text,
  limit_count integer,
  window_ms integer,
  requested_at timestamptz default timezone('utc', now())
)
returns table (
  allowed boolean,
  current_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_scope text := left(trim(coalesce(target_scope, '')), 120);
  normalized_subject text := left(trim(coalesce(target_subject, '')), 240);
  safe_limit integer := greatest(coalesce(limit_count, 0), 0);
  safe_window_ms integer := greatest(1000, least(coalesce(window_ms, 0), 7 * 24 * 60 * 60 * 1000));
  bucket_epoch_ms bigint;
  bucket_start_value timestamptz;
  reset_at_value timestamptz;
  current_count_value integer;
begin
  if normalized_scope = '' then
    raise exception 'target_scope_required';
  end if;

  if normalized_subject = '' then
    normalized_subject := 'anonymous';
  end if;

  if safe_limit <= 0 then
    raise exception 'limit_count_invalid';
  end if;

  bucket_epoch_ms := floor(extract(epoch from requested_at) * 1000 / safe_window_ms) * safe_window_ms;
  bucket_start_value := to_timestamp(bucket_epoch_ms::numeric / 1000.0);
  reset_at_value := bucket_start_value + ((safe_window_ms || ' milliseconds')::interval);

  insert into public.server_rate_limits as rl (
    scope,
    subject,
    bucket_start,
    count,
    expires_at
  )
  values (
    normalized_scope,
    normalized_subject,
    bucket_start_value,
    1,
    reset_at_value
  )
  on conflict (scope, subject, bucket_start)
  do update
    set
      count = rl.count + 1,
      expires_at = excluded.expires_at,
      updated_at = timezone('utc', now())
  returning count, expires_at
  into current_count_value, reset_at_value;

  delete from public.server_rate_limits
  where expires_at < requested_at - interval '1 hour'
    and random() < 0.02;

  return query select current_count_value <= safe_limit, current_count_value, reset_at_value;
end;
$$;
create or replace function public.log_client_telemetry_batch(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
  batch_count integer := 0;
  payload_bytes integer := 0;
begin
  if auth.uid() is null then
    raise exception 'telemetry_unauthorized';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'telemetry_payload_invalid';
  end if;

  batch_count := jsonb_array_length(payload);
  if batch_count = 0 then
    return 0;
  end if;

  if batch_count > 20 then
    raise exception 'telemetry_batch_too_large';
  end if;

  payload_bytes := octet_length(payload::text);
  if payload_bytes > 24576 then
    raise exception 'telemetry_payload_too_large';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(payload) as item
    where jsonb_typeof(item) <> 'object'
      or coalesce(length(trim(item->>'category')), 0) = 0
      or coalesce(length(trim(item->>'event_name')), 0) = 0
      or coalesce(length(trim(item->>'category')), 0) > 48
      or coalesce(length(trim(item->>'event_name')), 0) > 120
      or coalesce(length(trim(item->>'status')), 0) > 32
      or coalesce(length(trim(item->>'screen_key')), 0) > 120
      or coalesce(length(trim(item->>'path')), 0) > 240
      or ((item ? 'meta') and jsonb_typeof(item->'meta') <> 'object')
      or ((item ? 'meta') and octet_length((item->'meta')::text) > 4096)
      or ((item ? 'duration_ms') and jsonb_typeof(item->'duration_ms') <> 'number')
      or (
        (item ? 'timestamp')
        and nullif(trim(item->>'timestamp'), '') is not null
        and not ((item->>'timestamp') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T')
      )
  ) then
    raise exception 'telemetry_payload_invalid';
  end if;

  insert into public.client_telemetry_events (
    user_id,
    category,
    event_name,
    status,
    screen_key,
    path,
    duration_ms,
    meta,
    created_at
  )
  select
    auth.uid(),
    left(trim(item->>'category'), 48),
    left(trim(item->>'event_name'), 120),
    nullif(left(trim(item->>'status'), 32), ''),
    nullif(left(trim(item->>'screen_key'), 120), ''),
    nullif(left(trim(item->>'path'), 240), ''),
    case
      when jsonb_typeof(item->'duration_ms') = 'number'
        then greatest((item->>'duration_ms')::integer, 0)
      else null
    end,
    case
      when jsonb_typeof(item->'meta') = 'object'
        then item->'meta'
      else '{}'::jsonb
    end,
    case
      when nullif(trim(item->>'timestamp'), '') is not null
        then (item->>'timestamp')::timestamptz
      else now()
    end
  from jsonb_array_elements(payload) as item;

  get diagnostics inserted_count = row_count;

  insert into public.security_audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    result,
    metadata,
    created_at
  )
  select
    auth.uid(),
    left(
      coalesce(
        nullif(trim(item->'meta'->>'action'), ''),
        trim(item->>'event_name')
      ),
      120
    ),
    nullif(left(trim(coalesce(item->'meta'->>'resourceType', '')), 80), ''),
    nullif(left(trim(coalesce(item->'meta'->>'resourceId', '')), 240), ''),
    null,
    left(
      coalesce(
        nullif(trim(item->'meta'->>'result'), ''),
        nullif(trim(item->>'status'), ''),
        'success'
      ),
      32
    ),
    case
      when jsonb_typeof(item->'meta') = 'object'
        then item->'meta'
      else '{}'::jsonb
    end,
    case
      when nullif(trim(item->>'timestamp'), '') is not null
        then (item->>'timestamp')::timestamptz
      else now()
    end
  from jsonb_array_elements(payload) as item
  where trim(coalesce(item->>'category', '')) = 'security';
  return inserted_count;
end;
$$;
drop trigger if exists profiles_set_updated_by on public.profiles;
create trigger profiles_set_updated_by
before insert or update on public.profiles
for each row
execute function public.set_owned_record_updated_by('user_id');
drop trigger if exists events_set_updated_by on public.events;
create trigger events_set_updated_by
before insert or update on public.events
for each row
execute function public.set_owned_record_updated_by('club_id');
revoke all on function public.consume_server_rate_limit(text, text, integer, integer, timestamptz) from public;
revoke all on function public.consume_server_rate_limit(text, text, integer, integer, timestamptz) from anon;
revoke all on function public.consume_server_rate_limit(text, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.consume_server_rate_limit(text, text, integer, integer, timestamptz) to service_role;
grant execute on function public.log_client_telemetry_batch(jsonb) to authenticated;
