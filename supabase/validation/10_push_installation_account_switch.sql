-- Runtime validation for generation-ordered push registration and logout tombstones.
-- Synthetic Auth/Profile rows and all mutations are transaction-local and rolled back.

begin;

set local statement_timeout = '30s';

create temporary table push_installation_validation_results (
  check_name text not null,
  outcome text not null,
  detail text not null
);

do $$
declare
  function_config text[];
  state_table record;
  token_table record;
begin
  select c.relrowsecurity
    into token_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'push_device_tokens' and c.relkind = 'r';

  select c.relrowsecurity, c.relforcerowsecurity
    into state_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'internal_push_installation_state'
    and c.relkind = 'r';

  if token_table is null or not token_table.relrowsecurity then
    raise exception 'push_device_tokens must enable RLS';
  end if;
  if state_table is null or not state_table.relrowsecurity or not state_table.relforcerowsecurity then
    raise exception 'internal installation state must enable and force RLS';
  end if;

  if has_table_privilege('anon', 'public.internal_push_installation_state', 'select')
    or has_table_privilege('authenticated', 'public.internal_push_installation_state', 'select') then
    raise exception 'internal installation state must not be readable by app roles';
  end if;

  if has_function_privilege(
    'anon',
    'public.register_push_device_token(uuid,text,text,text,text,uuid,bigint)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.register_push_device_token(uuid,text,text,text,text,uuid,bigint)',
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.tombstone_push_installation(uuid,text,text,text,text,uuid,bigint)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.tombstone_push_installation(uuid,text,text,text,text,uuid,bigint)',
    'execute'
  ) then
    raise exception 'push ordering RPCs must not be executable by anon/authenticated';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.register_push_device_token(uuid,text,text,text,text,uuid,bigint)',
    'execute'
  ) or not has_function_privilege(
    'service_role',
    'public.tombstone_push_installation(uuid,text,text,text,text,uuid,bigint)',
    'execute'
  ) then
    raise exception 'push ordering RPCs must be executable by service_role';
  end if;

  select p.proconfig
    into function_config
  from pg_proc p
  where p.oid =
    'public.register_push_device_token(uuid,text,text,text,text,uuid,bigint)'::regprocedure;
  if not exists (
    select 1 from unnest(coalesce(function_config, '{}'::text[])) as config(value)
    where value = 'search_path=""'
  ) then
    raise exception 'register RPC search_path must be fixed empty';
  end if;

  select p.proconfig
    into function_config
  from pg_proc p
  where p.oid =
    'public.tombstone_push_installation(uuid,text,text,text,text,uuid,bigint)'::regprocedure;
  if not exists (
    select 1 from unnest(coalesce(function_config, '{}'::text[])) as config(value)
    where value = 'search_path=""'
  ) then
    raise exception 'tombstone RPC search_path must be fixed empty';
  end if;

  insert into push_installation_validation_results (check_name, outcome, detail)
  values (
    'push_installation_grants_rls_search_path',
    'passed',
    'internal state RLS forced; app roles denied; service RPCs use an empty search_path'
  );
end $$;

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  suffix_a text := replace(user_a::text, '-', '');
  suffix_b text := replace(user_b::text, '-', '');
begin
  insert into auth.users (id, is_sso_user, is_anonymous, email)
  values
    (user_a, false, false, 'push-validation-' || suffix_a || '@example.invalid'),
    (user_b, false, false, 'push-validation-' || suffix_b || '@example.invalid');

  insert into public.profiles (user_id, username, account_type, email, university, name)
  values
    (
      user_a,
      'pushval_' || left(suffix_a, 12),
      'student',
      'push-validation-' || suffix_a || '@example.invalid',
      'Validation University',
      'Push Validation A'
    ),
    (
      user_b,
      'pushval_' || left(suffix_b, 12),
      'student',
      'push-validation-' || suffix_b || '@example.invalid',
      'Validation University',
      'Push Validation B'
    );

  perform set_config('validation.push_installation_user_a', user_a::text, true);
  perform set_config('validation.push_installation_user_b', user_b::text, true);
end $$;

set local role service_role;

do $$
declare
  user_a uuid := current_setting('validation.push_installation_user_a')::uuid;
  user_b uuid := current_setting('validation.push_installation_user_b')::uuid;
  v_installation_id uuid := gen_random_uuid();
  moved_from_installation_id uuid := gen_random_uuid();
  moved_to_installation_id uuid := gen_random_uuid();
  v_project_id text := gen_random_uuid()::text;
  token_a text := 'ExponentPushToken[validation-a-' || replace(gen_random_uuid()::text, '-', '') || ']';
  token_b text := 'ExponentPushToken[validation-b-' || replace(gen_random_uuid()::text, '-', '') || ']';
  legacy_token text := 'ExponentPushToken[validation-legacy-' || replace(gen_random_uuid()::text, '-', '') || ']';
  nil_token text := 'ExponentPushToken[validation-nil-' || replace(gen_random_uuid()::text, '-', '') || ']';
  moved_token text := 'ExponentPushToken[validation-moved-' || replace(gen_random_uuid()::text, '-', '') || ']';
  v_result jsonb;
  active_count integer;
begin
  v_result := public.register_push_device_token(
    user_a, token_a, 'android', 'development', v_project_id, v_installation_id, 1
  );
  if not coalesce((v_result->>'applied')::boolean, false) then
    raise exception 'generation 1 registration must apply';
  end if;

  -- Missing stored registration logout: token is null, but the installation tombstone must apply.
  v_result := public.tombstone_push_installation(
    user_a, null, 'android', 'development', v_project_id, v_installation_id, 2
  );
  if not coalesce((v_result->>'applied')::boolean, false) then
    raise exception 'generation 2 installation tombstone must apply without a stored token';
  end if;

  v_result := public.register_push_device_token(
    user_a, token_a, 'android', 'development', v_project_id, v_installation_id, 1
  );
  if coalesce((v_result->>'applied')::boolean, true) then
    raise exception 'deferred register before logout must be rejected by the newer tombstone';
  end if;
  if exists (
    select 1 from public.push_device_tokens
    where installation_id = v_installation_id and is_active
  ) then
    raise exception 'late generation 1 registration must not reactivate after tombstone';
  end if;

  v_result := public.register_push_device_token(
    user_b, token_b, 'android', 'development', v_project_id, v_installation_id, 3
  );
  if not coalesce((v_result->>'applied')::boolean, false) then
    raise exception 'newer account B registration must apply';
  end if;

  -- Even a numerically later delayed A logout cannot tombstone the server-owned B state.
  v_result := public.tombstone_push_installation(
    user_a, token_a, 'android', 'development', v_project_id, v_installation_id, 4
  );
  if coalesce((v_result->>'applied')::boolean, true) then
    raise exception 'delayed A logout must not tombstone account B';
  end if;

  v_result := public.register_push_device_token(
    user_a, token_a, 'android', 'development', v_project_id, v_installation_id, 1
  );
  if coalesce((v_result->>'applied')::boolean, true) then
    raise exception 'A-to-B out-of-order registration must reject late A';
  end if;

  v_result := public.register_push_device_token(
    user_a, token_a, 'android', 'development', v_project_id, v_installation_id, 3
  );
  if coalesce((v_result->>'applied')::boolean, true) then
    raise exception 'equal conflicting generation must be rejected';
  end if;

  select count(*) into active_count
  from public.push_device_tokens
  where installation_id = v_installation_id
    and is_active
    and user_id = user_b
    and expo_push_token = token_b;
  if active_count <> 1 then
    raise exception 'same-installation registration must leave only the newer user/token active';
  end if;

  v_result := public.tombstone_push_installation(
    user_b, null, 'android', 'development', v_project_id, v_installation_id, 4
  );
  if not coalesce((v_result->>'applied')::boolean, false) then
    raise exception 'current owner tombstone must apply';
  end if;

  -- A token-only replay of a generation-tracked row must be rejected, while a genuinely legacy
  -- null-installation token remains compatible.
  v_result := public.register_push_device_token(
    user_b, token_b, 'android', 'development', v_project_id, null, null
  );
  if coalesce((v_result->>'applied')::boolean, true) then
    raise exception 'legacy replay must not reactivate a generation-tracked token';
  end if;

  v_result := public.register_push_device_token(
    user_a, legacy_token, 'android', 'development', v_project_id, null, null
  );
  if not coalesce((v_result->>'applied')::boolean, false) or not exists (
    select 1 from public.push_device_tokens
    where expo_push_token = legacy_token
      and user_id = user_a
      and installation_id is null
      and is_active
  ) then
    raise exception 'legacy registration without installation_id must remain compatible';
  end if;

  v_result := public.register_push_device_token(
    user_a,
    moved_token,
    'android',
    'development',
    v_project_id,
    moved_from_installation_id,
    1
  );
  if not coalesce((v_result->>'applied')::boolean, false) then
    raise exception 'moved-token source registration must apply';
  end if;
  v_result := public.register_push_device_token(
    user_a,
    moved_token,
    'android',
    'development',
    v_project_id,
    moved_to_installation_id,
    1
  );
  if not coalesce((v_result->>'applied')::boolean, false) then
    raise exception 'same Expo token must move to the newer installation state';
  end if;

  v_result := public.register_push_device_token(
    user_a,
    moved_token,
    'android',
    'development',
    v_project_id,
    moved_from_installation_id,
    1
  );
  if coalesce((v_result->>'applied')::boolean, true) then
    raise exception 'equal generation replay must reject state whose active token row moved away';
  end if;

  v_result := public.register_push_device_token(
    user_a,
    moved_token,
    'android',
    'development',
    v_project_id,
    moved_from_installation_id,
    2
  );
  if not coalesce((v_result->>'applied')::boolean, false) or not exists (
    select 1
    from public.push_device_tokens
    where installation_id = moved_from_installation_id
      and user_id = user_a
      and expo_push_token = moved_token
      and is_active
  ) then
    raise exception 'higher generation must recover a token row moved to another installation';
  end if;

  begin
    perform public.register_push_device_token(
      user_a,
      nil_token,
      'android',
      'development',
      v_project_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      5
    );
    raise exception 'nil installation UUID must be rejected';
  exception
    when invalid_parameter_value then null;
  end;

  delete from public.profiles where user_id = user_b;
  if exists (
    select 1 from public.internal_push_installation_state
    where installation_id = v_installation_id
  ) then
    raise exception 'profile deletion must cascade-purge internal installation state';
  end if;

  perform set_config('validation.push_installation_generation_outcome', 'passed', true);
end $$;

reset role;

insert into push_installation_validation_results (check_name, outcome, detail)
select
  'push_installation_generation_ordering',
  current_setting('validation.push_installation_generation_outcome', true),
  'stale writes rejected; tokenless tombstone, legacy null, owner mismatch, and delete purge verified';

select check_name, outcome, detail
from push_installation_validation_results
order by check_name;

rollback;
