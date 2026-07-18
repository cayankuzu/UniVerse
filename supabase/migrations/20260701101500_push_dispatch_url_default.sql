-- Replace the notification push webhook with a concrete dispatch URL so
-- restores and local deploys do not depend on ALTER DATABASE privileges.
create or replace function public.dispatch_notification_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id bigint;
  dispatch_url constant text :=
    'https://kfvdbfoufybltybsxlhh.supabase.co/functions/v1/server/make-server-e3557d40/push/dispatch';
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
    timeout_milliseconds := 5000
  )
  into request_id;

  return new;
exception
  when others then
    raise log 'dispatch_notification_push_webhook failed for notification %: %', new.id, sqlerrm;
    return new;
end;
$$;
