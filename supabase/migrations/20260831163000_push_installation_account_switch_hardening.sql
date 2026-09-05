-- Push token values rotate and requests can complete out of order. Keep an internal,
-- installation-wide generation so a late registration can never overtake a logout tombstone
-- or a newer account registration. Legacy clients that never supplied installation metadata
-- continue to use the token-only path.

alter table public.push_device_tokens
  add column if not exists installation_id uuid;

alter table public.push_device_tokens
  drop constraint if exists push_device_tokens_installation_id_not_nil;

alter table public.push_device_tokens
  add constraint push_device_tokens_installation_id_not_nil check (
    installation_id is null
    or installation_id <> '00000000-0000-0000-0000-000000000000'::uuid
  );

alter table public.push_device_tokens enable row level security;

create index if not exists idx_push_device_tokens_installation_lookup
  on public.push_device_tokens (installation_id, is_active)
  where installation_id is not null;

create unique index if not exists idx_push_device_tokens_one_active_installation
  on public.push_device_tokens (installation_id)
  where installation_id is not null
    and is_active;

create table if not exists public.internal_push_installation_state (
  installation_id uuid primary key,
  generation bigint not null,
  owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
  app_env text not null,
  platform text not null,
  expo_project_id text,
  active_expo_push_token text,
  is_tombstoned boolean not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint internal_push_installation_state_id_not_nil check (
    installation_id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  constraint internal_push_installation_state_generation_positive check (generation > 0),
  constraint internal_push_installation_state_app_env check (
    app_env in ('development', 'preview', 'production')
  ),
  constraint internal_push_installation_state_platform check (platform in ('android', 'ios')),
  constraint internal_push_installation_state_project_format check (
    expo_project_id is null
    or expo_project_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  constraint internal_push_installation_state_token_shape check (
    (is_tombstoned and active_expo_push_token is null)
    or (
      not is_tombstoned
      and active_expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
    )
  )
);

alter table public.internal_push_installation_state enable row level security;
alter table public.internal_push_installation_state force row level security;

revoke all on table public.internal_push_installation_state from public;
revoke all on table public.internal_push_installation_state from anon;
revoke all on table public.internal_push_installation_state from authenticated;
grant select, insert, update on table public.internal_push_installation_state to service_role;

create or replace function public.register_push_device_token(
  p_user_id uuid,
  p_expo_push_token text,
  p_platform text,
  p_app_env text,
  p_expo_project_id text default null,
  p_installation_id uuid default null,
  p_generation bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_installation_id uuid;
  v_has_state boolean := false;
  v_legacy_rows_affected bigint := 0;
  v_state public.internal_push_installation_state%rowtype;
begin
  if p_user_id is null then
    raise exception 'push registration user is required' using errcode = '22023';
  end if;

  if p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' then
    raise exception 'push registration token is invalid' using errcode = '22023';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'push registration platform is invalid' using errcode = '22023';
  end if;

  if p_app_env not in ('development', 'preview', 'production') then
    raise exception 'push registration environment is invalid' using errcode = '22023';
  end if;

  if p_expo_project_id is not null
    and p_expo_project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'push registration project is invalid' using errcode = '22023';
  end if;

  if (p_installation_id is null) <> (p_generation is null) then
    raise exception 'push installation and generation must be supplied together'
      using errcode = '22023';
  end if;

  if p_installation_id = '00000000-0000-0000-0000-000000000000'::uuid
    or (p_generation is not null and p_generation <= 0) then
    raise exception 'push installation generation is invalid' using errcode = '22023';
  end if;

  if p_installation_id is null then
    -- A pure legacy row remains usable. Once a token is generation-tracked, however, an
    -- unordered legacy replay must not be allowed to reactivate it after a tombstone.
    select installation_id
      into v_existing_installation_id
    from public.push_device_tokens
    where expo_push_token = p_expo_push_token
    for update;

    if v_existing_installation_id is not null then
      select generation
        into p_generation
      from public.internal_push_installation_state
      where installation_id = v_existing_installation_id;

      return pg_catalog.jsonb_build_object(
        'applied', false,
        'currentGeneration', coalesce(p_generation, 0)
      );
    end if;

    insert into public.push_device_tokens (
      app_env,
      expo_project_id,
      expo_push_token,
      installation_id,
      is_active,
      last_registered_at,
      last_seen_at,
      platform,
      user_id
    )
    values (
      p_app_env,
      p_expo_project_id,
      p_expo_push_token,
      null,
      true,
      pg_catalog.timezone('utc', pg_catalog.now()),
      pg_catalog.timezone('utc', pg_catalog.now()),
      p_platform,
      p_user_id
    )
    on conflict (expo_push_token) do update
    set
      app_env = excluded.app_env,
      expo_project_id = excluded.expo_project_id,
      is_active = true,
      last_registered_at = excluded.last_registered_at,
      last_seen_at = excluded.last_seen_at,
      platform = excluded.platform,
      user_id = excluded.user_id
    where public.push_device_tokens.installation_id is null;

    get diagnostics v_legacy_rows_affected = row_count;

    return pg_catalog.jsonb_build_object(
      'applied', v_legacy_rows_affected > 0,
      'currentGeneration', 0
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('push-installation:' || p_installation_id::text, 0)
  );

  select *
    into v_state
  from public.internal_push_installation_state
  where installation_id = p_installation_id
  for update;
  v_has_state := found;

  if v_has_state and p_generation < v_state.generation then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'currentGeneration', v_state.generation
    );
  end if;

  if v_has_state and p_generation = v_state.generation then
    return pg_catalog.jsonb_build_object(
      'applied',
      not v_state.is_tombstoned
        and v_state.owner_user_id = p_user_id
        and v_state.active_expo_push_token = p_expo_push_token
        and v_state.app_env = p_app_env
        and v_state.platform = p_platform
        and v_state.expo_project_id is not distinct from p_expo_project_id
        and exists (
          select 1
          from public.push_device_tokens as token
          where token.installation_id = p_installation_id
            and token.user_id = p_user_id
            and token.expo_push_token = p_expo_push_token
            and token.app_env = p_app_env
            and token.platform = p_platform
            and token.expo_project_id is not distinct from p_expo_project_id
            and token.is_active
        ),
      'currentGeneration',
      v_state.generation
    );
  end if;

  update public.push_device_tokens
  set
    is_active = false,
    last_seen_at = pg_catalog.timezone('utc', pg_catalog.now())
  where installation_id = p_installation_id
    and is_active;

  insert into public.push_device_tokens (
    app_env,
    expo_project_id,
    expo_push_token,
    installation_id,
    is_active,
    last_registered_at,
    last_seen_at,
    platform,
    user_id
  )
  values (
    p_app_env,
    p_expo_project_id,
    p_expo_push_token,
    p_installation_id,
    true,
    pg_catalog.timezone('utc', pg_catalog.now()),
    pg_catalog.timezone('utc', pg_catalog.now()),
    p_platform,
    p_user_id
  )
  on conflict (expo_push_token) do update
  set
    app_env = excluded.app_env,
    expo_project_id = excluded.expo_project_id,
    installation_id = excluded.installation_id,
    is_active = true,
    last_registered_at = excluded.last_registered_at,
    last_seen_at = excluded.last_seen_at,
    platform = excluded.platform,
    user_id = excluded.user_id;

  insert into public.internal_push_installation_state (
    installation_id,
    generation,
    owner_user_id,
    app_env,
    platform,
    expo_project_id,
    active_expo_push_token,
    is_tombstoned,
    updated_at
  )
  values (
    p_installation_id,
    p_generation,
    p_user_id,
    p_app_env,
    p_platform,
    p_expo_project_id,
    p_expo_push_token,
    false,
    pg_catalog.timezone('utc', pg_catalog.now())
  )
  on conflict (installation_id) do update
  set
    generation = excluded.generation,
    owner_user_id = excluded.owner_user_id,
    app_env = excluded.app_env,
    platform = excluded.platform,
    expo_project_id = excluded.expo_project_id,
    active_expo_push_token = excluded.active_expo_push_token,
    is_tombstoned = false,
    updated_at = excluded.updated_at;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'currentGeneration', p_generation
  );
end;
$$;

create or replace function public.tombstone_push_installation(
  p_user_id uuid,
  p_expo_push_token text,
  p_platform text,
  p_app_env text,
  p_expo_project_id text,
  p_installation_id uuid,
  p_generation bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_state boolean := false;
  v_state public.internal_push_installation_state%rowtype;
begin
  if p_user_id is null then
    raise exception 'push tombstone user is required' using errcode = '22023';
  end if;

  if p_expo_push_token is not null
    and p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' then
    raise exception 'push tombstone token is invalid' using errcode = '22023';
  end if;

  if p_platform not in ('android', 'ios')
    or p_app_env not in ('development', 'preview', 'production') then
    raise exception 'push tombstone context is invalid' using errcode = '22023';
  end if;

  if p_expo_project_id is not null
    and p_expo_project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'push tombstone project is invalid' using errcode = '22023';
  end if;

  if p_installation_id is null
    or p_installation_id = '00000000-0000-0000-0000-000000000000'::uuid
    or p_generation is null
    or p_generation <= 0 then
    raise exception 'push tombstone generation is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('push-installation:' || p_installation_id::text, 0)
  );

  select *
    into v_state
  from public.internal_push_installation_state
  where installation_id = p_installation_id
  for update;
  v_has_state := found;

  -- A delayed logout from account A must not tombstone account B even if its local operation
  -- happened to reserve a later number after B became the server-side owner.
  if v_has_state and v_state.owner_user_id <> p_user_id then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'currentGeneration', v_state.generation
    );
  end if;

  if v_has_state and p_generation < v_state.generation then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'currentGeneration', v_state.generation
    );
  end if;

  if v_has_state and p_generation = v_state.generation then
    return pg_catalog.jsonb_build_object(
      'applied',
      v_state.is_tombstoned
        and v_state.owner_user_id = p_user_id
        and v_state.app_env = p_app_env
        and v_state.platform = p_platform
        and v_state.expo_project_id is not distinct from p_expo_project_id,
      'currentGeneration',
      v_state.generation
    );
  end if;

  update public.push_device_tokens
  set
    is_active = false,
    last_seen_at = pg_catalog.timezone('utc', pg_catalog.now())
  where (
      installation_id = p_installation_id
      or (
        p_expo_push_token is not null
        and expo_push_token = p_expo_push_token
        and user_id = p_user_id
      )
    )
    and is_active;

  insert into public.internal_push_installation_state (
    installation_id,
    generation,
    owner_user_id,
    app_env,
    platform,
    expo_project_id,
    active_expo_push_token,
    is_tombstoned,
    updated_at
  )
  values (
    p_installation_id,
    p_generation,
    p_user_id,
    p_app_env,
    p_platform,
    p_expo_project_id,
    null,
    true,
    pg_catalog.timezone('utc', pg_catalog.now())
  )
  on conflict (installation_id) do update
  set
    generation = excluded.generation,
    owner_user_id = excluded.owner_user_id,
    app_env = excluded.app_env,
    platform = excluded.platform,
    expo_project_id = excluded.expo_project_id,
    active_expo_push_token = null,
    is_tombstoned = true,
    updated_at = excluded.updated_at;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'currentGeneration', p_generation
  );
end;
$$;

revoke all on function public.register_push_device_token(uuid, text, text, text, text, uuid, bigint) from public;
revoke all on function public.register_push_device_token(uuid, text, text, text, text, uuid, bigint) from anon;
revoke all on function public.register_push_device_token(uuid, text, text, text, text, uuid, bigint) from authenticated;
grant execute on function public.register_push_device_token(uuid, text, text, text, text, uuid, bigint) to service_role;

revoke all on function public.tombstone_push_installation(uuid, text, text, text, text, uuid, bigint) from public;
revoke all on function public.tombstone_push_installation(uuid, text, text, text, text, uuid, bigint) from anon;
revoke all on function public.tombstone_push_installation(uuid, text, text, text, text, uuid, bigint) from authenticated;
grant execute on function public.tombstone_push_installation(uuid, text, text, text, text, uuid, bigint) to service_role;
