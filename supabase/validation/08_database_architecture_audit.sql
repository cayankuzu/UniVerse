do $$
declare
  missing_tables text[];
begin
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
  select array_agg(table_name order by table_name)
    into missing_tables
  from required_tables
  where to_regclass('public.' || table_name) is null;

  if coalesce(array_length(missing_tables, 1), 0) > 0 then
    raise exception 'Missing required domain tables: %', array_to_string(missing_tables, ', ');
  end if;
end $$;

do $$
declare
  missing_views text[];
begin
  with required_views(view_name) as (
    values
      ('event_summary'),
      ('album_summary'),
      ('profile_summary'),
      ('notification_summary')
  )
  select array_agg(view_name order by view_name)
    into missing_views
  from required_views
  where to_regclass('public.' || view_name) is null;

  if coalesce(array_length(missing_views, 1), 0) > 0 then
    raise exception 'Missing required summary views: %', array_to_string(missing_views, ', ');
  end if;
end $$;

do $$
declare
  missing_functions text[];
begin
  with required_functions(signature) as (
    values
      ('public.notification_badge_projection(uuid,timestamptz,text)'),
      ('public.notifications_projection(uuid,text,text,integer,timestamptz,text,uuid)'),
      ('public.relationship_list_projection(uuid,text,text,text,integer,timestamptz,text)'),
      ('public.profile_overview_projection(uuid,text,timestamptz,text)'),
      ('public.profile_content_projection(uuid,text,text,text,integer,timestamptz,text)'),
      ('public.club_members_projection(uuid,text,text,integer,timestamptz,boolean,text)'),
      ('public.home_feed_projection(uuid,text,integer,timestamptz,text,text,text,text,text)'),
      ('public.search_results_projection(uuid,text,text,text,text,text,text,text,text,integer,timestamptz,text)'),
      ('public.profile_screen_projection(uuid,text,text,text,integer,timestamptz,text)'),
      ('public.blocked_users_projection(uuid,text,integer,timestamptz,text)'),
      ('public.event_detail_projection(uuid,uuid,timestamptz,text)'),
      ('public.album_event_projection(uuid,uuid,text,integer,timestamptz,text)'),
      ('public.event_comments_projection(uuid,uuid,text,integer,timestamptz,text)'),
      ('public.event_likers_projection(uuid,uuid,text,integer,timestamptz,text)'),
      ('public.event_attendees_projection(uuid,uuid,text,integer,timestamptz,text)'),
      ('public.album_comments_projection(uuid,uuid,text,integer,timestamptz,text)'),
      ('public.event_comment_likers_projection(uuid,uuid,text,integer,timestamptz,text)'),
      ('public.album_comment_likers_projection(uuid,uuid,text,integer,timestamptz,text)')
  )
  select array_agg(signature order by signature)
    into missing_functions
  from required_functions
  where to_regprocedure(signature) is null;

  if coalesce(array_length(missing_functions, 1), 0) > 0 then
    raise exception 'Missing standardized projection signatures: %', array_to_string(missing_functions, ', ');
  end if;
end $$;

do $$
declare
  missing_helper_functions text[];
begin
  with required_helper_functions(signature) as (
    values
      ('public.build_projection_envelope(jsonb,jsonb,jsonb,text,timestamptz,timestamptz)')
  )
  select array_agg(signature order by signature)
    into missing_helper_functions
  from required_helper_functions
  where to_regprocedure(signature) is null;

  if coalesce(array_length(missing_helper_functions, 1), 0) > 0 then
    raise exception 'Missing required projection helper functions: %', array_to_string(missing_helper_functions, ', ');
  end if;
end $$;

do $$
declare
  missing_columns text[];
begin
  with required_columns(table_name, column_name) as (
    values
      ('profiles', 'last_activity_at'),
      ('profiles', 'sync_version'),
      ('profiles', 'deleted_at'),
      ('events', 'last_activity_at'),
      ('events', 'sync_version'),
      ('events', 'deleted_at'),
      ('album_photos', 'last_activity_at'),
      ('album_photos', 'sync_version'),
      ('album_photos', 'deleted_at'),
      ('notifications', 'last_activity_at'),
      ('notifications', 'sync_version'),
      ('notifications', 'deleted_at'),
      ('follows', 'last_activity_at'),
      ('follows', 'sync_version'),
      ('follows', 'deleted_at'),
      ('club_memberships', 'last_activity_at'),
      ('club_memberships', 'sync_version'),
      ('club_memberships', 'deleted_at'),
      ('profiles', 'updated_by'),
      ('events', 'updated_by')
  )
  select array_agg(format('%s.%s', table_name, column_name) order by table_name, column_name)
    into missing_columns
  from required_columns rc
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = rc.table_name
      and c.column_name = rc.column_name
  );

  if coalesce(array_length(missing_columns, 1), 0) > 0 then
    raise exception 'Missing required architecture columns: %', array_to_string(missing_columns, ', ');
  end if;
end $$;

do $$
declare
  missing_triggers text[];
begin
  with required_triggers(table_name, trigger_name) as (
    values
      ('profiles', 'profiles_set_updated_by'),
      ('events', 'events_set_updated_by')
  )
  select array_agg(format('%s.%s', table_name, trigger_name) order by table_name, trigger_name)
    into missing_triggers
  from required_triggers rt
  where not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = rt.table_name
      and t.tgname = rt.trigger_name
      and not t.tgisinternal
  );

  if coalesce(array_length(missing_triggers, 1), 0) > 0 then
    raise exception 'Missing updated_by trigger coverage: %', array_to_string(missing_triggers, ', ');
  end if;
end $$;

do $$
declare
  missing_indexes text[];
begin
  with required_indexes(index_name) as (
    values
      ('idx_events_visibility_last_activity_id'),
      ('idx_events_club_last_activity_id'),
      ('idx_album_photos_event_last_activity_id'),
      ('idx_album_photos_owner_last_activity_id'),
      ('idx_notifications_user_read_last_activity_id'),
      ('idx_follows_follower_status_last_activity_id'),
      ('idx_follows_following_status_last_activity_id'),
      ('idx_memberships_club_status_last_activity_id'),
      ('idx_memberships_member_status_last_activity_id'),
      ('idx_event_comments_event_created_id'),
      ('idx_album_comments_photo_created_id'),
      ('profiles_updated_by_idx'),
      ('events_updated_by_idx'),
      ('idx_notifications_actor_id'),
      ('idx_notifications_event_id'),
      ('idx_notifications_target_profile_id'),
      ('idx_event_comments_user_id'),
      ('idx_event_comments_parent_id'),
      ('idx_album_photo_comments_user_id'),
      ('idx_album_photo_comments_parent_id'),
      ('idx_reports_target_user_id'),
      ('idx_reports_target_event_id'),
      ('idx_reports_reviewed_by'),
      ('idx_blocks_blocker_created_blocked'),
      ('idx_event_likes_event_created_user'),
      ('idx_event_attendees_event_joined_user')
  )
  select array_agg(index_name order by index_name)
    into missing_indexes
  from required_indexes ri
  where not exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.indexname = ri.index_name
  );

  if coalesce(array_length(missing_indexes, 1), 0) > 0 then
    raise exception 'Missing required database architecture indexes: %', array_to_string(missing_indexes, ', ');
  end if;
end $$;

select
  'database_architecture_audit_ok' as tag,
  17 as required_table_count,
  4 as required_view_count,
  18 as required_projection_signature_count,
  1 as required_projection_helper_count,
  26 as required_index_count;
