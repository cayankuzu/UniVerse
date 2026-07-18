do $reinstall_pg_net$
declare
  installed_schema text := null;
  unexpected_dependencies text := null;
  dependency_row record;
begin
  select n.nspname
    into installed_schema
  from pg_extension e
  join pg_namespace n
    on n.oid = e.extnamespace
  where e.extname = 'pg_net';

  if installed_schema is null or installed_schema <> 'public' then
    return;
  end if;

  -- Supabase Cloud can report the extension namespace as `public` while the
  -- callable pg_net functions already live under `net`. In that state forcing
  -- a reinstall makes the extension script collide with the existing `net`
  -- schema, so keep the database stable and only recreate the dispatch trigger.
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    return;
  end if;

  drop trigger if exists dispatch_notification_push_after_insert
    on public.notifications;

  drop function if exists public.dispatch_notification_push_webhook();

  if to_regprocedure('private_api.dispatch_notification_push_webhook()') is not null then
    drop function private_api.dispatch_notification_push_webhook();
  end if;

  for dependency_row in
    with candidate_functions as (
      select
        p.oid,
        p.proname,
        n.nspname,
        pg_get_function_identity_arguments(p.oid) as identity_arguments
      from pg_proc p
      join pg_namespace n
        on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema', 'net')
        and p.prokind = 'f'
    )
    select format(
      'FUNCTION %I.%I(%s)',
      candidate_functions.nspname,
      candidate_functions.proname,
      candidate_functions.identity_arguments
    ) as dependency
    from candidate_functions
    where pg_get_functiondef(candidate_functions.oid) ilike '%net.%'
      and format(
        '%I.%I(%s)',
        candidate_functions.nspname,
        candidate_functions.proname,
        candidate_functions.identity_arguments
      ) <> 'public.dispatch_notification_push_webhook()'
      and format(
        '%I.%I(%s)',
        candidate_functions.nspname,
        candidate_functions.proname,
        candidate_functions.identity_arguments
      ) <> 'extensions.grant_pg_net_access()'
  loop
    unexpected_dependencies := concat_ws(E'\n', unexpected_dependencies, dependency_row.dependency);
  end loop;

  if unexpected_dependencies is not null then
    raise exception using
      message = 'pg_net reinstall aborted due to unexpected net-schema dependencies',
      detail = unexpected_dependencies;
  end if;

  drop extension if exists pg_net;

  create schema if not exists net;
  create extension if not exists pg_net with schema net;
end;
$reinstall_pg_net$;
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
drop trigger if exists dispatch_notification_push_after_insert on public.notifications;
create trigger dispatch_notification_push_after_insert
after insert on public.notifications
for each row execute function public.dispatch_notification_push_webhook();
