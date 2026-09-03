-- Bind every push attempt to the notification recipient and the current token/installation
-- revision. Provider I/O cannot participate in the database transaction, so the payload is
-- separately constrained to privacy-safe content by the dispatch service.

alter table public.push_device_tokens
  add column if not exists delivery_revision bigint not null default 1;

alter table public.push_device_tokens
  drop constraint if exists push_device_tokens_delivery_revision_positive;

alter table public.push_device_tokens
  add constraint push_device_tokens_delivery_revision_positive check (delivery_revision > 0);

alter table public.notification_push_deliveries
  add column if not exists recipient_user_id uuid references public.profiles(user_id) on delete cascade,
  add column if not exists token_revision bigint,
  add column if not exists installation_generation bigint,
  add column if not exists delivery_lease_id uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists lease_consumed_at timestamptz;

create unique index if not exists idx_notification_push_deliveries_active_lease
  on public.notification_push_deliveries (delivery_lease_id)
  where delivery_lease_id is not null;

create index if not exists idx_notification_push_deliveries_recipient_status
  on public.notification_push_deliveries (recipient_user_id, status, attempted_at);

create index if not exists idx_internal_push_installation_state_owner
  on public.internal_push_installation_state (owner_user_id, installation_id);

create or replace function public.enforce_push_installation_state_owner_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_state_count integer;
begin
  if tg_op = 'UPDATE' and old.owner_user_id = new.owner_user_id then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('push-installation-owner:' || new.owner_user_id::text, 0)
  );

  select count(*)
    into v_owner_state_count
  from public.internal_push_installation_state as state
  where state.owner_user_id = new.owner_user_id
    and state.installation_id <> new.installation_id;

  if v_owner_state_count >= 64 then
    raise exception 'push installation state owner limit exceeded'
      using errcode = '54000';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_push_installation_state_owner_cap_before_write
  on public.internal_push_installation_state;
create trigger enforce_push_installation_state_owner_cap_before_write
before insert or update of owner_user_id on public.internal_push_installation_state
for each row
execute function public.enforce_push_installation_state_owner_cap();

create or replace function public.bump_push_token_delivery_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id is distinct from new.user_id
    or old.expo_push_token is distinct from new.expo_push_token
    or old.platform is distinct from new.platform
    or old.app_env is distinct from new.app_env
    or old.expo_project_id is distinct from new.expo_project_id
    or old.installation_id is distinct from new.installation_id
    or old.is_active is distinct from new.is_active then
    new.delivery_revision := old.delivery_revision + 1;
  else
    new.delivery_revision := old.delivery_revision;
  end if;
  return new;
end;
$$;

create or replace function public.invalidate_push_delivery_leases_for_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_push_deliveries
  set
    delivery_lease_id = null,
    error_code = 'token-owner-revision-changed',
    error_message = 'Push delivery lease invalidated before provider confirmation.',
    lease_consumed_at = null,
    lease_expires_at = null,
    response = null,
    status = 'skipped',
    ticket_id = null
  where push_token_id = new.id
    and status = 'pending'
    and ticket_id is null;
  return new;
end;
$$;

create or replace function public.invalidate_push_delivery_leases_for_installation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_push_deliveries as delivery
  set
    delivery_lease_id = null,
    error_code = 'installation-owner-revision-changed',
    error_message = 'Push installation changed before provider confirmation.',
    lease_consumed_at = null,
    lease_expires_at = null,
    response = null,
    status = 'skipped',
    ticket_id = null
  from public.push_device_tokens as token
  where token.id = delivery.push_token_id
    and token.installation_id = new.installation_id
    and delivery.status = 'pending'
    and delivery.ticket_id is null;
  return new;
end;
$$;

drop trigger if exists bump_push_token_delivery_revision_before_update
  on public.push_device_tokens;
create trigger bump_push_token_delivery_revision_before_update
before update on public.push_device_tokens
for each row
execute function public.bump_push_token_delivery_revision();

drop trigger if exists invalidate_push_delivery_leases_after_token_update
  on public.push_device_tokens;
create trigger invalidate_push_delivery_leases_after_token_update
after update of user_id, expo_push_token, platform, app_env, expo_project_id, installation_id, is_active
on public.push_device_tokens
for each row
when (
  old.user_id is distinct from new.user_id
  or old.expo_push_token is distinct from new.expo_push_token
  or old.platform is distinct from new.platform
  or old.app_env is distinct from new.app_env
  or old.expo_project_id is distinct from new.expo_project_id
  or old.installation_id is distinct from new.installation_id
  or old.is_active is distinct from new.is_active
)
execute function public.invalidate_push_delivery_leases_for_token();

drop trigger if exists invalidate_push_delivery_leases_after_installation_update
  on public.internal_push_installation_state;
create trigger invalidate_push_delivery_leases_after_installation_update
after update of generation, owner_user_id, app_env, platform, expo_project_id,
  active_expo_push_token, is_tombstoned
on public.internal_push_installation_state
for each row
when (
  old.generation is distinct from new.generation
  or old.owner_user_id is distinct from new.owner_user_id
  or old.app_env is distinct from new.app_env
  or old.platform is distinct from new.platform
  or old.expo_project_id is distinct from new.expo_project_id
  or old.active_expo_push_token is distinct from new.active_expo_push_token
  or old.is_tombstoned is distinct from new.is_tombstoned
)
execute function public.invalidate_push_delivery_leases_for_installation();

create or replace function public.claim_notification_push_delivery_leases(
  p_notification_id uuid,
  p_app_env text,
  p_lease_seconds integer default 30
)
returns table (
  notification_id uuid,
  push_token_id uuid,
  delivery_lease_id uuid,
  token_revision bigint,
  installation_generation bigint,
  recipient_user_id uuid,
  expo_push_token text,
  platform text,
  app_env text,
  expo_project_id text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease interval := pg_catalog.make_interval(
    secs => greatest(least(coalesce(p_lease_seconds, 30), 90), 10)
  );
begin
  if p_notification_id is null
    or p_app_env not in ('development', 'preview', 'production') then
    return;
  end if;

  return query
  with eligible as (
    select
      notification.id as notification_id,
      notification.user_id as recipient_user_id,
      token.id as push_token_id,
      token.delivery_revision as token_revision,
      state.generation as installation_generation
    from public.notifications as notification
    join public.push_device_tokens as token
      on token.user_id = notification.user_id
     and token.is_active
     and token.app_env = p_app_env
    join public.profiles as recipient_profile
      on recipient_profile.user_id = notification.user_id
    left join public.internal_push_installation_state as state
      on state.installation_id = token.installation_id
    where notification.id = p_notification_id
      and notification.deleted_at is null
      and not coalesce(notification.is_read, false)
      and (
        notification.type not in (
          'follow_request'::public.notification_type,
          'join_request'::public.notification_type
        )
        or coalesce(notification.request_status, 'pending') = 'pending'
      )
      and (notification.actor_id is null or notification.actor_id <> notification.user_id)
      and coalesce(recipient_profile.notification_preferences->>'push', 'true') <> 'false'
      and (
        notification.actor_id is null
        or not public.is_blocked_pair(notification.user_id, notification.actor_id)
      )
      and (
        token.installation_id is null
        or (
          not state.is_tombstoned
          and state.owner_user_id = notification.user_id
          and state.app_env = token.app_env
          and state.platform = token.platform
          and state.expo_project_id is not distinct from token.expo_project_id
          and state.active_expo_push_token = token.expo_push_token
        )
      )
    for update of token
  ),
  claimed as (
    insert into public.notification_push_deliveries (
      notification_id,
      push_token_id,
      attempted_at,
      delivered_at,
      error_code,
      error_message,
      response,
      status,
      ticket_id,
      recipient_user_id,
      token_revision,
      installation_generation,
      delivery_lease_id,
      lease_expires_at,
      lease_consumed_at
    )
    select
      eligible.notification_id,
      eligible.push_token_id,
      pg_catalog.timezone('utc', pg_catalog.now()),
      null,
      null,
      null,
      null,
      'pending',
      null,
      eligible.recipient_user_id,
      eligible.token_revision,
      eligible.installation_generation,
      pg_catalog.gen_random_uuid(),
      pg_catalog.timezone('utc', pg_catalog.now()) + v_lease,
      null
    from eligible
    on conflict on constraint notification_push_deliveries_pkey do update
    set
      attempted_at = excluded.attempted_at,
      delivered_at = null,
      error_code = null,
      error_message = null,
      response = null,
      status = 'pending',
      ticket_id = null,
      recipient_user_id = excluded.recipient_user_id,
      token_revision = excluded.token_revision,
      installation_generation = excluded.installation_generation,
      delivery_lease_id = excluded.delivery_lease_id,
      lease_expires_at = excluded.lease_expires_at,
      lease_consumed_at = null
    where (
         public.notification_push_deliveries.status = 'error'
         and public.notification_push_deliveries.lease_consumed_at is null
       )
       or (
         public.notification_push_deliveries.status = 'pending'
         and public.notification_push_deliveries.ticket_id is null
         and public.notification_push_deliveries.lease_consumed_at is null
         and (
           (
             public.notification_push_deliveries.delivery_lease_id is null
             and public.notification_push_deliveries.attempted_at
               <= pg_catalog.timezone('utc', pg_catalog.now()) - interval '2 minutes'
           )
           or public.notification_push_deliveries.lease_expires_at
             <= pg_catalog.timezone('utc', pg_catalog.now())
         )
       )
    returning
      public.notification_push_deliveries.notification_id,
      public.notification_push_deliveries.push_token_id,
      public.notification_push_deliveries.delivery_lease_id,
      public.notification_push_deliveries.token_revision,
      public.notification_push_deliveries.installation_generation,
      public.notification_push_deliveries.recipient_user_id
  )
  select
    claimed.notification_id,
    claimed.push_token_id,
    claimed.delivery_lease_id,
    claimed.token_revision,
    claimed.installation_generation,
    claimed.recipient_user_id,
    token.expo_push_token,
    token.platform,
    token.app_env,
    token.expo_project_id
  from claimed
  join public.push_device_tokens as token
    on token.id = claimed.push_token_id
   and token.delivery_revision = claimed.token_revision
   and token.user_id = claimed.recipient_user_id
   and token.is_active;
end;
$$;

create or replace function public.consume_notification_push_delivery_lease(
  p_notification_id uuid,
  p_push_token_id uuid,
  p_delivery_lease_id uuid
)
returns table (
  notification_id uuid,
  push_token_id uuid,
  delivery_lease_id uuid,
  token_revision bigint,
  installation_generation bigint,
  recipient_user_id uuid,
  expo_push_token text,
  platform text,
  app_env text,
  expo_project_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_notification_id is null or p_push_token_id is null or p_delivery_lease_id is null then
    return;
  end if;

  return query
  update public.notification_push_deliveries as delivery
  set
    attempted_at = pg_catalog.timezone('utc', pg_catalog.now()),
    lease_consumed_at = pg_catalog.timezone('utc', pg_catalog.now()),
    lease_expires_at = pg_catalog.timezone('utc', pg_catalog.now()) + interval '30 seconds'
  from public.push_device_tokens as token,
    public.notifications as notification,
    public.profiles as recipient_profile
  where delivery.notification_id = p_notification_id
    and delivery.push_token_id = p_push_token_id
    and delivery.delivery_lease_id = p_delivery_lease_id
    and delivery.status = 'pending'
    and delivery.ticket_id is null
    and delivery.lease_consumed_at is null
    and delivery.lease_expires_at > pg_catalog.timezone('utc', pg_catalog.now())
    and notification.id = delivery.notification_id
    and notification.user_id = delivery.recipient_user_id
    and recipient_profile.user_id = notification.user_id
    and notification.deleted_at is null
    and not coalesce(notification.is_read, false)
    and (
      notification.type not in (
        'follow_request'::public.notification_type,
        'join_request'::public.notification_type
      )
      or coalesce(notification.request_status, 'pending') = 'pending'
    )
    and (notification.actor_id is null or notification.actor_id <> notification.user_id)
    and coalesce(recipient_profile.notification_preferences->>'push', 'true') <> 'false'
    and (
      notification.actor_id is null
      or not public.is_blocked_pair(notification.user_id, notification.actor_id)
    )
    and token.id = delivery.push_token_id
    and token.user_id = delivery.recipient_user_id
    and token.delivery_revision = delivery.token_revision
    and token.is_active
    and (
      token.installation_id is null
      or exists (
        select 1
        from public.internal_push_installation_state as state
        where state.installation_id = token.installation_id
          and state.generation = delivery.installation_generation
          and not state.is_tombstoned
          and state.owner_user_id = notification.user_id
          and state.app_env = token.app_env
          and state.platform = token.platform
          and state.expo_project_id is not distinct from token.expo_project_id
          and state.active_expo_push_token = token.expo_push_token
      )
    )
  returning
    delivery.notification_id,
    delivery.push_token_id,
    delivery.delivery_lease_id,
    delivery.token_revision,
    delivery.installation_generation,
    delivery.recipient_user_id,
    token.expo_push_token,
    token.platform,
    token.app_env,
    token.expo_project_id;
end;
$$;

create or replace function public.finalize_notification_push_delivery(
  p_notification_id uuid,
  p_push_token_id uuid,
  p_delivery_lease_id uuid,
  p_token_revision bigint,
  p_status text,
  p_ticket_id text,
  p_error_code text,
  p_error_message text,
  p_response jsonb,
  p_release_for_retry boolean,
  p_deactivate_token boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid;
begin
  if p_notification_id is null
    or p_push_token_id is null
    or p_delivery_lease_id is null
    or p_token_revision is null
    or p_token_revision <= 0
    or p_status not in ('pending', 'error')
    or (p_status = 'pending' and coalesce(pg_catalog.btrim(p_ticket_id), '') = '')
    or (p_status = 'error' and p_ticket_id is not null)
    or (coalesce(p_release_for_retry, false) and p_status <> 'error')
    or (coalesce(p_deactivate_token, false) and p_status <> 'error') then
    return false;
  end if;

  update public.notification_push_deliveries as delivery
  set
    attempted_at = pg_catalog.timezone('utc', pg_catalog.now()),
    delivered_at = null,
    error_code = p_error_code,
    error_message = p_error_message,
    response = p_response,
    status = p_status,
    ticket_id = p_ticket_id,
    lease_consumed_at = case
      when coalesce(p_release_for_retry, false) then null
      else delivery.lease_consumed_at
    end
  where delivery.notification_id = p_notification_id
    and delivery.push_token_id = p_push_token_id
    and delivery.delivery_lease_id = p_delivery_lease_id
    and delivery.token_revision = p_token_revision
    and delivery.status = 'pending'
    and delivery.ticket_id is null
    and delivery.lease_consumed_at is not null
  returning delivery.recipient_user_id
    into v_recipient_user_id;

  if not found or v_recipient_user_id is null then
    return false;
  end if;

  if coalesce(p_deactivate_token, false) then
    update public.push_device_tokens as token
    set
      is_active = false,
      last_seen_at = pg_catalog.timezone('utc', pg_catalog.now())
    where token.id = p_push_token_id
      and token.user_id = v_recipient_user_id
      and token.delivery_revision = p_token_revision
      and token.is_active;

    if not found then
      raise exception 'push token deactivation was not confirmed'
        using errcode = 'P0001';
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.bump_push_token_delivery_revision() from public, anon, authenticated;
revoke all on function public.enforce_push_installation_state_owner_cap()
  from public, anon, authenticated;
revoke all on function public.invalidate_push_delivery_leases_for_token() from public, anon, authenticated;
revoke all on function public.invalidate_push_delivery_leases_for_installation() from public, anon, authenticated;

revoke all on function public.claim_notification_push_delivery_leases(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_push_delivery_leases(uuid, text, integer)
  to service_role;

revoke all on function public.consume_notification_push_delivery_lease(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.consume_notification_push_delivery_lease(uuid, uuid, uuid)
  to service_role;

revoke all on function public.finalize_notification_push_delivery(
  uuid, uuid, uuid, bigint, text, text, text, text, jsonb, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.finalize_notification_push_delivery(
  uuid, uuid, uuid, bigint, text, text, text, text, jsonb, boolean, boolean
) to service_role;

-- A pre-lease Edge rollback can read a token and serialize private content before an account
-- switch. Disable that legacy claim path at the database boundary. Rollback must use a generic
-- payload lease-aware Edge version; otherwise push delivery intentionally fails closed.
revoke execute on function public.claim_notification_push_deliveries(uuid, uuid[])
  from service_role;
