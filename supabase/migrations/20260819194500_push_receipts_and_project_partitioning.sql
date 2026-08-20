create extension if not exists pg_cron;

alter table public.push_device_tokens
  add column if not exists expo_project_id text;

alter table public.push_device_tokens
  drop constraint if exists push_device_tokens_expo_project_id_check;

alter table public.push_device_tokens
  add constraint push_device_tokens_expo_project_id_check check (
    expo_project_id is null
    or expo_project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

create index if not exists idx_push_device_tokens_user_active_env_project
  on public.push_device_tokens (user_id, is_active, app_env, expo_project_id);

create index if not exists idx_notification_push_deliveries_pending_receipts
  on public.notification_push_deliveries (attempted_at)
  where status = 'pending' and ticket_id is not null;

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
    where public.notification_push_deliveries.status = 'error'
       or (
         public.notification_push_deliveries.status = 'pending'
         and public.notification_push_deliveries.ticket_id is null
         and public.notification_push_deliveries.attempted_at
           <= timezone('utc', now()) - interval '2 minutes'
       )
    returning push_token_id
  )
  select coalesce(array_agg(push_token_id), '{}'::uuid[])
  into claimed_ids
  from claimed;

  return claimed_ids;
end;
$$;

revoke all on function public.claim_notification_push_deliveries(uuid, uuid[]) from public;
grant execute on function public.claim_notification_push_deliveries(uuid, uuid[]) to service_role;

do $block$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'universe-push-receipts-v1'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'universe-push-receipts-v1',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := 'https://kfvdbfoufybltybsxlhh.supabase.co/functions/v1/server/make-server-e3557d40/push/dispatch',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('drain', true),
        timeout_milliseconds := 15000
      );
    $cron$
  );
end;
$block$;
