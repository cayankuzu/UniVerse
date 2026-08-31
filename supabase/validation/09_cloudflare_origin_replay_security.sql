begin;

do $$
declare
  nonce_table record;
  nonce_value uuid := gen_random_uuid();
  request_time timestamptz := clock_timestamp();
begin
  select c.relrowsecurity, c.relforcerowsecurity
    into nonce_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'cloudflare_origin_request_nonces'
    and c.relkind = 'r';

  if nonce_table is null then
    raise exception 'cloudflare_origin_request_nonces table is missing';
  end if;
  if not nonce_table.relrowsecurity or not nonce_table.relforcerowsecurity then
    raise exception 'Cloudflare nonce table must enable and force RLS';
  end if;
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cloudflare_origin_request_nonces'
  ) then
    raise exception 'Cloudflare nonce table must not expose an RLS policy';
  end if;
  if has_table_privilege('anon', 'public.cloudflare_origin_request_nonces', 'select')
     or has_table_privilege('authenticated', 'public.cloudflare_origin_request_nonces', 'select') then
    raise exception 'Cloudflare nonce rows must not be readable by client roles';
  end if;
  if has_function_privilege(
    'anon',
    'public.claim_cloudflare_origin_request_nonce(uuid,timestamptz,timestamptz,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.claim_cloudflare_origin_request_nonce(uuid,timestamptz,timestamptz,text,text)',
    'execute'
  ) then
    raise exception 'Cloudflare nonce claim RPC must not be executable by client roles';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.claim_cloudflare_origin_request_nonce(uuid,timestamptz,timestamptz,text,text)',
    'execute'
  ) then
    raise exception 'Cloudflare nonce claim RPC must be executable by service_role';
  end if;

  if not public.claim_cloudflare_origin_request_nonce(
    nonce_value,
    request_time,
    request_time + interval '121 seconds',
    'validation-request',
    'reports.create'
  ) then
    raise exception 'First Cloudflare nonce claim must succeed';
  end if;
  if public.claim_cloudflare_origin_request_nonce(
    nonce_value,
    request_time,
    request_time + interval '121 seconds',
    'validation-request',
    'reports.create'
  ) then
    raise exception 'Duplicate Cloudflare nonce claim must be rejected';
  end if;
end $$;

select
  'cloudflare_origin_replay_security_ok' as tag,
  true as rls_fail_closed,
  true as replay_rejected;

rollback;
