-- Canonical baseline migration.
-- Sources:
--   - 20260326170000_search_projection_hardening.sql
--   - 20260326230000_home_notifications_hot_path_surgery.sql
--   - 20260326232000_search_event_hot_path_surgery.sql
--   - 20260327001000_projection_hot_path_page_first_hydration.sql
--   - 20260327030000_profile_home_projection_stability_followup.sql

create or replace function public.build_prefix_search_tsquery(query_text text)
returns tsquery
language sql
immutable
set search_path = public
as $$
  with tokens as (
    select distinct regexp_replace(lower(trim(token)), '[^[:alnum:]_]+', '', 'g') as token
    from regexp_split_to_table(coalesce(query_text, ''), '\s+') as token
  ),
  normalized as (
    select token
    from tokens
    where char_length(token) >= 2
    order by token
    limit 6
  )
  select case
    when exists (select 1 from normalized)
      then to_tsquery('simple', string_agg(token || ':*', ' & '))
    else null::tsquery
  end
  from normalized;
$$;
create index if not exists idx_events_created_live
  on public.events (created_at desc, id desc)
  where deleted_at is null;
create index if not exists idx_events_club_created_live
  on public.events (club_id, created_at desc, id desc)
  where deleted_at is null;
create index if not exists idx_event_attendees_user_event
  on public.event_attendees (user_id, event_id);
create index if not exists idx_album_photos_user_created_live
  on public.album_photos (user_id, created_at desc, id desc)
  where deleted_at is null;
create index if not exists idx_notifications_user_activity_live
  on public.notifications (user_id, last_activity_at desc, id desc)
  where deleted_at is null;
create index if not exists idx_notifications_user_type_activity_live
  on public.notifications (user_id, type, last_activity_at desc, id desc)
  where deleted_at is null;
create index if not exists idx_follows_pair_latest_projection
  on public.follows (
    follower_id,
    following_id,
    coalesce(last_activity_at, responded_at, created_at) desc,
    created_at desc,
    id desc
  );
create index if not exists idx_follows_active_accepted_pair_projection
  on public.follows (follower_id, following_id)
  where deleted_at is null
    and status = 'accepted';
create index if not exists idx_album_photos_event_created_live
  on public.album_photos (event_id, created_at desc, id desc)
  where deleted_at is null;
create index if not exists idx_album_photos_user_created_profile_user_live
  on public.album_photos (user_id, created_at desc, id desc)
  where deleted_at is null
    and coalesce(show_on_user_profile, show_on_profile, false);
create index if not exists idx_album_photos_user_created_profile_club_live
  on public.album_photos (user_id, created_at desc, id desc)
  where deleted_at is null
    and coalesce(show_on_club_profile, show_on_profile, false);
create index if not exists idx_album_photos_event_created_profile_surface_live
  on public.album_photos (event_id, created_at desc, id desc)
  where deleted_at is null
    and (
      coalesce(show_on_club_profile, show_on_profile, false)
      or coalesce(show_on_user_profile, show_on_profile, false)
    );
create index if not exists idx_profiles_search_vector
  on public.profiles
  using gin (
    to_tsvector(
      'simple',
      coalesce(username, '') || ' ' ||
      coalesce(name, '') || ' ' ||
      coalesce(club_name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(bio, '')
    )
  );
create index if not exists idx_events_search_vector_live
  on public.events
  using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(location_name, '')
    )
  )
  where deleted_at is null;
create index if not exists idx_events_title_prefix
  on public.events (lower(title) text_pattern_ops);
create index if not exists idx_events_location_prefix
  on public.events (lower(location_name) text_pattern_ops);
create index if not exists idx_profiles_username_prefix
  on public.profiles (lower(username) text_pattern_ops);
create index if not exists idx_profiles_name_prefix
  on public.profiles (lower(name) text_pattern_ops);
create index if not exists idx_profiles_club_name_prefix
  on public.profiles (lower(club_name) text_pattern_ops);
create index if not exists idx_album_photos_title_prefix
  on public.album_photos (lower(title) text_pattern_ops)
  where deleted_at is null;
create index if not exists idx_album_photos_caption_prefix
  on public.album_photos (lower(caption) text_pattern_ops)
  where deleted_at is null;
alter function public.home_feed_projection(uuid, text, integer, timestamptz, text, text, text, text)
  set statement_timeout = '10s';
alter function public.home_feed_projection(uuid, text, integer, timestamptz, text, text, text, text, text)
  set statement_timeout = '10s';
alter function public.search_results_projection(uuid, text, text, text, text, text, text, text, text, integer, timestamptz)
  set statement_timeout = '10s';
alter function public.search_results_projection(uuid, text, text, text, text, text, text, text, text, integer, timestamptz, text)
  set statement_timeout = '10s';
alter function public.notifications_projection(uuid, text, text, integer, timestamptz, text)
  set statement_timeout = '10s';
alter function public.profile_content_projection(uuid, text, text, text, integer, timestamptz, text)
  set statement_timeout = '10s';
alter function public.profile_screen_projection(uuid, text, text, text, integer, timestamptz, text)
  set statement_timeout = '10s';
alter function public.event_detail_projection(uuid, uuid, timestamptz, text)
  set statement_timeout = '10s';
