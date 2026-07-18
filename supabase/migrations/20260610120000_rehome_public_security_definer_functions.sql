create schema if not exists private_api;
grant usage on schema private_api to public, anon, authenticated, service_role;
revoke create on schema private_api from public;
revoke create on schema private_api from anon;
revoke create on schema private_api from authenticated;
comment on schema private_api is
  'Holds internal SECURITY DEFINER routines that should not be exposed through PostgREST RPC.';
do $rehome_security_definers$
declare
  fn record;
  grant_row record;
  grant_target text;
  param_refs text;
  volatility_keyword text;
  wrapper_sql text;
  arg_ordinal integer;
begin
  for fn in
    select
      p.oid,
      p.proname,
      p.pronargs,
      p.proowner,
      p.proacl,
      p.proretset,
      p.provolatile,
      t.typname as return_type_name,
      pg_get_function_arguments(p.oid) as function_arguments,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      oidvectortypes(p.proargtypes) as regprocedure_arguments,
      pg_get_function_result(p.oid) as function_result
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    join pg_type t
      on t.oid = p.prorettype
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind = 'f'
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    param_refs := null;

    if fn.pronargs > 0 then
      for arg_ordinal in 1..fn.pronargs loop
        param_refs := concat_ws(', ', param_refs, format('$%s', arg_ordinal));
      end loop;
    end if;

    param_refs := coalesce(param_refs, '');

    if to_regprocedure(format('private_api.%I(%s)', fn.proname, fn.regprocedure_arguments)) is not null then
      execute format(
        'drop function private_api.%I(%s)',
        fn.proname,
        fn.regprocedure_arguments
      );
    end if;

    execute format(
      'alter function public.%I(%s) set schema private_api',
      fn.proname,
      fn.regprocedure_arguments
    );

    volatility_keyword := case fn.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;

    if fn.return_type_name in ('trigger', 'event_trigger') then
      continue;
    elsif fn.function_result = 'void' then
      wrapper_sql := format(
        'create or replace function public.%1$I(%2$s) returns %3$s language sql %4$s security invoker set search_path = '''' as $wrapper$ select private_api.%1$I(%5$s); $wrapper$',
        fn.proname,
        fn.function_arguments,
        fn.function_result,
        volatility_keyword,
        param_refs
      );
    elsif fn.proretset then
      wrapper_sql := format(
        'create or replace function public.%1$I(%2$s) returns %3$s language sql %4$s security invoker set search_path = '''' as $wrapper$ select * from private_api.%1$I(%5$s); $wrapper$',
        fn.proname,
        fn.function_arguments,
        fn.function_result,
        volatility_keyword,
        param_refs
      );
    else
      wrapper_sql := format(
        'create or replace function public.%1$I(%2$s) returns %3$s language sql %4$s security invoker set search_path = '''' as $wrapper$ select private_api.%1$I(%5$s); $wrapper$',
        fn.proname,
        fn.function_arguments,
        fn.function_result,
        volatility_keyword,
        param_refs
      );
    end if;

    execute wrapper_sql;

    for grant_row in
      select
        acl.grantee,
        roles.rolname
      from aclexplode(coalesce(fn.proacl, acldefault('f', fn.proowner))) as acl
      left join pg_roles roles
        on roles.oid = acl.grantee
      where acl.privilege_type = 'EXECUTE'
    loop
      grant_target := case
        when grant_row.grantee = 0 then 'public'
        else format('%I', grant_row.rolname)
      end;

      execute format(
        'grant execute on function public.%I(%s) to %s',
        fn.proname,
        fn.regprocedure_arguments,
        grant_target
      );
    end loop;
  end loop;
end;
$rehome_security_definers$;
