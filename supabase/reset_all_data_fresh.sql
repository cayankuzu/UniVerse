-- DANGER
-- This script wipes all application/user data from the currently connected
-- Supabase project while preserving schema, migrations, functions, policies,
-- extensions and storage bucket definitions.
--
-- WHAT IT CLEARS
-- 1) All rows in public application tables
-- 2) All auth users plus auth session/token/MFA state
-- 3) All storage metadata rows except bucket definitions
--
-- WHAT IT PRESERVES
-- - schema structure
-- - migration history
-- - functions / triggers / policies / indexes
-- - auth instance/config tables
-- - storage bucket definitions
--
-- IMPORTANT
-- - Run this only from Supabase SQL Editor with a privileged role.
-- - This clears database-side storage metadata. If you need physically empty
--   buckets, also verify/remove remaining files from Supabase Storage.

begin;

set local statement_timeout = 0;
set local lock_timeout = 0;

-- 1) Wipe every app table in public while keeping migration/system tables.
do $$
declare
  truncate_sql text;
begin
  select
    'truncate table ' ||
    string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename) ||
    ' restart identity cascade'
  into truncate_sql
  from pg_tables
  where schemaname = 'public'
    and tablename not in ('schema_migrations', 'spatial_ref_sys');

  if truncate_sql is not null then
    execute truncate_sql;
  end if;
end $$;

-- 2) Wipe storage data rows but keep bucket definitions and storage migrations.
do $$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_tables
    where schemaname = 'storage'
      and tablename not in (
        'buckets',
        'migrations',
        'schema_migrations',
        'buckets_analytics',
        'buckets_vectors',
        'vector_indexes'
      )
    order by tablename
  loop
    begin
      execute format('truncate table %I.%I restart identity cascade', 'storage', table_name);
    exception
      when insufficient_privilege then
        raise notice 'Skipped storage.% due to insufficient privilege.', table_name;
    end;
  end loop;
end $$;

-- 3) Wipe auth-side user data but keep auth instance/config tables.
do $$
declare
  truncate_sql text;
begin
  select
    'truncate table ' ||
    string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename) ||
    ' cascade'
  into truncate_sql
  from pg_tables
  where schemaname = 'auth'
    and tablename not in (
      'instances',
      'schema_migrations',
      'saml_providers',
      'sso_domains',
      'sso_providers'
    );

  if truncate_sql is not null then
    execute truncate_sql;
  end if;
end $$;

commit;

-- Optional verification queries:
-- select count(*) as public_profiles from public.profiles;
-- select count(*) as public_events from public.events;
-- select count(*) as auth_users from auth.users;
-- select count(*) as storage_objects from storage.objects;
