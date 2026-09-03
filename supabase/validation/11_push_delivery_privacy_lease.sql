-- Runtime validation for recipient-bound push delivery leases.
-- All synthetic users, tokens, notifications, and deliveries are rolled back.

begin;

set local statement_timeout = '30s';

create temporary table push_delivery_privacy_validation_results (
  check_name text not null,
  outcome text not null,
  detail text not null
);

do $$
declare
  function_config text[];
begin
  if has_function_privilege(
    'anon',
    'public.claim_notification_push_delivery_leases(uuid,text,integer)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.claim_notification_push_delivery_leases(uuid,text,integer)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.consume_notification_push_delivery_lease(uuid,uuid,uuid)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.consume_notification_push_delivery_lease(uuid,uuid,uuid)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.finalize_notification_push_delivery(uuid,uuid,uuid,bigint,text,text,text,text,jsonb,boolean,boolean)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.finalize_notification_push_delivery(uuid,uuid,uuid,bigint,text,text,text,text,jsonb,boolean,boolean)',
    'execute'
  ) then
    raise exception 'push delivery lease RPCs must be denied to app roles';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.claim_notification_push_delivery_leases(uuid,text,integer)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.consume_notification_push_delivery_lease(uuid,uuid,uuid)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.finalize_notification_push_delivery(uuid,uuid,uuid,bigint,text,text,text,text,jsonb,boolean,boolean)',
    'execute'
  ) then
    raise exception 'push delivery lease RPCs must be executable by service_role';
  end if;

  select proconfig
    into function_config
  from pg_proc
  where oid =
    'public.claim_notification_push_delivery_leases(uuid,text,integer)'::regprocedure;
  if not exists (
    select 1 from unnest(coalesce(function_config, '{}'::text[])) as config(value)
    where value = 'search_path=""'
  ) then
    raise exception 'claim delivery lease RPC search_path must be fixed empty';
  end if;

  select proconfig
    into function_config
  from pg_proc
  where oid =
    'public.consume_notification_push_delivery_lease(uuid,uuid,uuid)'::regprocedure;
  if not exists (
    select 1 from unnest(coalesce(function_config, '{}'::text[])) as config(value)
    where value = 'search_path=""'
  ) then
    raise exception 'consume delivery lease RPC search_path must be fixed empty';
  end if;

  select proconfig
    into function_config
  from pg_proc
  where oid =
    'public.finalize_notification_push_delivery(uuid,uuid,uuid,bigint,text,text,text,text,jsonb,boolean,boolean)'::regprocedure;
  if not exists (
    select 1 from unnest(coalesce(function_config, '{}'::text[])) as config(value)
    where value = 'search_path=""'
  ) then
    raise exception 'finalize delivery RPC search_path must be fixed empty';
  end if;

  insert into push_delivery_privacy_validation_results (check_name, outcome, detail)
  values (
    'push_delivery_lease_grants_search_path',
    'passed',
    'app roles denied; service role granted; claim and consume use empty search_path'
  );
end $$;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  user_c uuid := gen_random_uuid();
  suffix_a text := replace(user_a::text, '-', '');
  suffix_b text := replace(user_b::text, '-', '');
  suffix_c text := replace(user_c::text, '-', '');
begin
  insert into auth.users (id, is_sso_user, is_anonymous, email)
  values
    (user_a, false, false, 'push-lease-a-' || suffix_a || '@example.invalid'),
    (user_b, false, false, 'push-lease-b-' || suffix_b || '@example.invalid'),
    (user_c, false, false, 'push-lease-c-' || suffix_c || '@example.invalid');

  insert into public.profiles (user_id, username, account_type, email, university, name)
  values
    (
      user_a,
      'pushleasea_' || left(suffix_a, 10),
      'student',
      'push-lease-a-' || suffix_a || '@example.invalid',
      'Validation University',
      'Push Lease A'
    ),
    (
      user_b,
      'pushleaseb_' || left(suffix_b, 10),
      'student',
      'push-lease-b-' || suffix_b || '@example.invalid',
      'Validation University',
      'Push Lease B'
    ),
    (
      user_c,
      'pushleasec_' || left(suffix_c, 10),
      'student',
      'push-lease-c-' || suffix_c || '@example.invalid',
      'Validation University',
      'Push Lease C'
    );

  perform set_config('validation.push_lease_user_a', user_a::text, true);
  perform set_config('validation.push_lease_user_b', user_b::text, true);
  perform set_config('validation.push_lease_user_c', user_c::text, true);
end $$;

set local role service_role;

do $$
declare
  user_a uuid := current_setting('validation.push_lease_user_a')::uuid;
  user_b uuid := current_setting('validation.push_lease_user_b')::uuid;
  user_c uuid := current_setting('validation.push_lease_user_c')::uuid;
  installation_id uuid := gen_random_uuid();
  project_id text := gen_random_uuid()::text;
  shared_token text :=
    'ExponentPushToken[privacy-lease-' || replace(gen_random_uuid()::text, '-', '') || ']';
  first_notification_id uuid;
  second_notification_id uuid;
  third_notification_id uuid;
  fourth_notification_id uuid;
  claimed record;
  consumed record;
  third_claimed record;
  fourth_claimed record;
  register_result jsonb;
begin
  register_result := public.register_push_device_token(
    user_a, shared_token, 'android', 'development', project_id, installation_id, 1
  );
  if not coalesce((register_result->>'applied')::boolean, false) then
    raise exception 'initial A registration must apply';
  end if;

  insert into public.notifications (user_id, actor_id, type, message, detail)
  values (user_a, user_b, 'comment', 'private-message-marker', 'private-detail-marker')
  returning id into first_notification_id;

  select *
    into claimed
  from public.claim_notification_push_delivery_leases(
    first_notification_id,
    'development',
    30
  );
  if not found
    or claimed.recipient_user_id <> user_a
    or claimed.expo_push_token <> shared_token
    or claimed.platform <> 'android'
    or claimed.app_env <> 'development'
    or claimed.expo_project_id <> project_id
    or claimed.token_revision <= 0
    or claimed.installation_generation <> 1 then
    raise exception 'claim must return the current A recipient/token/env/project revision';
  end if;

  register_result := public.register_push_device_token(
    user_b, shared_token, 'android', 'development', project_id, installation_id, 2
  );
  if not coalesce((register_result->>'applied')::boolean, false) then
    raise exception 'B reassignment must apply';
  end if;

  if exists (
    select 1
    from public.consume_notification_push_delivery_lease(
      first_notification_id,
      claimed.push_token_id,
      claimed.delivery_lease_id
    )
  ) then
    raise exception 'A lease must not consume after token reassignment to B';
  end if;

  if not exists (
    select 1
    from public.notification_push_deliveries
    where notification_id = first_notification_id
      and push_token_id = claimed.push_token_id
      and status = 'skipped'
      and delivery_lease_id is null
  ) then
    raise exception 'reassignment must invalidate the pending A delivery lease';
  end if;

  if exists (
    select 1
    from public.claim_notification_push_delivery_leases(
      first_notification_id,
      'development',
      30
    )
  ) then
    raise exception 'A notification must not claim B-owned installation token';
  end if;

  register_result := public.register_push_device_token(
    user_a, shared_token, 'android', 'development', project_id, installation_id, 3
  );
  if not coalesce((register_result->>'applied')::boolean, false) then
    raise exception 'newer A registration must apply';
  end if;

  insert into public.notifications (user_id, actor_id, type, message, detail)
  values (user_a, user_b, 'comment', 'second-private-marker', 'second-detail-marker')
  returning id into second_notification_id;

  if exists (
    select 1
    from public.claim_notification_push_delivery_leases(
      second_notification_id,
      'production',
      30
    )
  ) then
    raise exception 'environment mismatch must not claim a token';
  end if;

  select *
    into claimed
  from public.claim_notification_push_delivery_leases(
    second_notification_id,
    'development',
    30
  );
  if not found then
    raise exception 'second A delivery lease must be claimable';
  end if;

  select *
    into consumed
  from public.consume_notification_push_delivery_lease(
    second_notification_id,
    claimed.push_token_id,
    claimed.delivery_lease_id
  );
  if not found
    or consumed.recipient_user_id <> user_a
    or consumed.expo_push_token <> shared_token
    or consumed.token_revision <> claimed.token_revision then
    raise exception 'consume must atomically return the same current A token revision';
  end if;

  insert into public.notifications (user_id, actor_id, type, message, detail)
  values (user_a, user_b, 'comment', 'third-private-marker', 'third-detail-marker')
  returning id into third_notification_id;

  select *
    into third_claimed
  from public.claim_notification_push_delivery_leases(
    third_notification_id,
    'development',
    30
  );
  if not found then
    raise exception 'third A delivery lease must be claimable';
  end if;
  perform *
  from public.consume_notification_push_delivery_lease(
    third_notification_id,
    third_claimed.push_token_id,
    third_claimed.delivery_lease_id
  );
  if not found then
    raise exception 'third A delivery lease must consume';
  end if;

  update public.notification_push_deliveries
  set lease_expires_at = pg_catalog.timezone('utc', pg_catalog.now()) - interval '1 second'
  where notification_id = third_notification_id
    and push_token_id = third_claimed.push_token_id;

  if exists (
    select 1
    from public.claim_notification_push_delivery_leases(
      third_notification_id,
      'development',
      30
    )
  ) then
    raise exception 'expired consumed lease must not be reclaimed after ambiguous provider I/O';
  end if;

  insert into public.notifications (user_id, actor_id, type, message, detail)
  values (user_a, user_b, 'comment', 'fourth-private-marker', 'fourth-detail-marker')
  returning id into fourth_notification_id;

  select *
    into fourth_claimed
  from public.claim_notification_push_delivery_leases(
    fourth_notification_id,
    'development',
    30
  );
  if not found then
    raise exception 'fourth A delivery lease must be claimable';
  end if;
  perform *
  from public.consume_notification_push_delivery_lease(
    fourth_notification_id,
    fourth_claimed.push_token_id,
    fourth_claimed.delivery_lease_id
  );
  if not found or not public.finalize_notification_push_delivery(
    fourth_notification_id,
    fourth_claimed.push_token_id,
    fourth_claimed.delivery_lease_id,
    fourth_claimed.token_revision,
    'pending',
    'validation-expo-ticket-id',
    null,
    null,
    jsonb_build_object('status', 'ok', 'ticketId', 'validation-expo-ticket-id'),
    false,
    false
  ) then
    raise exception 'finalize RPC must atomically persist a valid provider ticket';
  end if;

  if not exists (
    select 1
    from public.notification_push_deliveries
    where notification_id = fourth_notification_id
      and push_token_id = fourth_claimed.push_token_id
      and status = 'pending'
      and ticket_id = 'validation-expo-ticket-id'
  ) then
    raise exception 'finalized provider ticket must be durable';
  end if;

  register_result := public.register_push_device_token(
    user_b, shared_token, 'android', 'development', project_id, installation_id, 4
  );
  if not coalesce((register_result->>'applied')::boolean, false) then
    raise exception 'post-consume B reassignment must apply';
  end if;

  if not exists (
    select 1
    from public.notification_push_deliveries
    where notification_id = second_notification_id
      and push_token_id = claimed.push_token_id
      and status = 'skipped'
      and delivery_lease_id is null
      and ticket_id is null
  ) then
    raise exception 'post-consume reassignment must invalidate an unconfirmed provider attempt';
  end if;

  insert into public.internal_push_installation_state (
    installation_id,
    generation,
    owner_user_id,
    app_env,
    platform,
    expo_project_id,
    active_expo_push_token,
    is_tombstoned
  )
  select
    gen_random_uuid(),
    1,
    user_c,
    'development',
    'android',
    null,
    null,
    true
  from generate_series(1, 64);

  begin
    insert into public.internal_push_installation_state (
      installation_id,
      generation,
      owner_user_id,
      app_env,
      platform,
      expo_project_id,
      active_expo_push_token,
      is_tombstoned
    )
    values (gen_random_uuid(), 1, user_c, 'development', 'android', null, null, true);
    raise exception '65th installation state must be rejected';
  exception
    when program_limit_exceeded then null;
  end;

  if (
    select count(*)
    from public.internal_push_installation_state
    where owner_user_id = user_c
  ) <> 64 then
    raise exception 'installation owner cap must retain exactly 64 states';
  end if;

  perform set_config('validation.push_delivery_privacy_outcome', 'passed', true);
end $$;

reset role;

insert into push_delivery_privacy_validation_results (check_name, outcome, detail)
select
  'push_delivery_recipient_revision_race',
  current_setting('validation.push_delivery_privacy_outcome', true),
  'claim/consume bind current owner; reassignment invalidates leases; per-owner state cap rejects 65th installation';

select check_name, outcome, detail
from push_delivery_privacy_validation_results
order by check_name;

rollback;
