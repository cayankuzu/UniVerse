do $$
declare
  failing_tables text[];
begin
  select array_agg(result.table_name order by result.table_name)
    into failing_tables
  from (
    with required_tables(table_name) as (
      values
        ('profiles'),
        ('blocks'),
        ('follows'),
        ('club_memberships'),
        ('events'),
        ('event_attendees'),
        ('event_likes'),
        ('event_comments'),
        ('event_comment_likes'),
        ('album_photos'),
        ('album_photo_likes'),
        ('album_photo_comments'),
        ('album_photo_comment_likes'),
        ('notifications'),
        ('reports'),
        ('media_assets'),
        ('client_telemetry_events')
    )
    select
      required_tables.table_name
    from required_tables
    left join pg_class c
      on c.relnamespace = 'public'::regnamespace
     and c.relname = required_tables.table_name
    left join pg_policy p
      on p.polrelid = c.oid
    group by required_tables.table_name, c.oid, c.relrowsecurity
    having c.oid is null
      or c.relrowsecurity is distinct from true
      or count(p.polname) = 0
  ) as result;

  if coalesce(array_length(failing_tables, 1), 0) > 0 then
    raise exception 'RLS audit failed for tables: %', array_to_string(failing_tables, ', ');
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.can_view_media_object(text,uuid)') is null then
    raise exception 'Missing function public.can_view_media_object(text, uuid).';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'updated_by'
  ) then
    raise exception 'profiles.updated_by column is missing.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'updated_by'
  ) then
    raise exception 'events.updated_by column is missing.';
  end if;
end $$;

do $$
declare
  active_bucket_public boolean;
begin
  select b.public
    into active_bucket_public
  from storage.buckets b
  where b.id = 'make-e3557d40-media';

  if active_bucket_public is null then
    raise exception 'Active storage bucket make-e3557d40-media is missing.';
  end if;

  if active_bucket_public then
    raise exception 'Active storage bucket make-e3557d40-media must remain private.';
  end if;
end $$;

do $$
declare
  missing_policies text[];
begin
  select array_agg(policy_name order by policy_name)
    into missing_policies
  from (
    with required_policies(policy_name) as (
      values
        ('media_bucket_select_visible_or_owner'),
        ('media_bucket_insert_own_folder'),
        ('media_bucket_update_own_folder'),
        ('media_bucket_delete_own_folder')
    )
    select required_policies.policy_name
    from required_policies
    where not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'storage'
        and p.tablename = 'objects'
        and p.policyname = required_policies.policy_name
    )
  ) as result;

  if coalesce(array_length(missing_policies, 1), 0) > 0 then
    raise exception 'Missing storage policies: %', array_to_string(missing_policies, ', ');
  end if;

  if exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.policyname = 'media_read_authenticated'
  ) then
    raise exception 'Legacy broad storage read policy media_read_authenticated must be removed.';
  end if;
end $$;

do $$
declare
  media_assets_policy text;
begin
  select p.qual
    into media_assets_policy
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'media_assets'
    and p.policyname = 'media_assets_select_visible_or_owner';

  if media_assets_policy is null then
    raise exception 'media_assets_select_visible_or_owner policy is missing.';
  end if;

  if position('can_view_media_object' in media_assets_policy) = 0 then
    raise exception 'media_assets select policy must use can_view_media_object.';
  end if;
end $$;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policy_count
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relnamespace = 'public'::regnamespace
  and c.relname in (
    'profiles',
    'blocks',
    'follows',
    'club_memberships',
    'events',
    'event_attendees',
    'event_likes',
    'event_comments',
    'event_comment_likes',
    'album_photos',
    'album_photo_likes',
    'album_photo_comments',
    'album_photo_comment_likes',
    'notifications',
    'reports',
    'media_assets',
    'client_telemetry_events'
  )
group by c.relname, c.relrowsecurity
order by c.relname;
