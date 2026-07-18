-- Hot-path projection EXPLAIN ANALYZE pack
-- Run this file in staging or production-like SQL context.

begin;

set local statement_timeout = '30s';

create temporary table validation_context as
with sample_viewer as (
  select p.user_id, p.username
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_profile as (
  select p.user_id, p.username
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_club as (
  select p.user_id, p.username
  from public.profiles p
  where p.account_type = 'club'
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id, e.club_id
  from public.events e
  where e.deleted_at is null
  order by e.created_at desc nulls last, e.id desc
  limit 1
),
sample_photo as (
  select ap.id, ap.event_id, ap.user_id
  from public.album_photos ap
  where ap.deleted_at is null
  order by ap.created_at desc nulls last, ap.id desc
  limit 1
),
sample_notification as (
  select n.id, n.user_id
  from public.notifications n
  where n.deleted_at is null
  order by n.created_at desc nulls last, n.id desc
  limit 1
)
select
  (select user_id from sample_viewer) as viewer_id,
  (select username from sample_profile) as profile_username,
  (select username from sample_club) as club_username,
  (select id from sample_event) as event_id,
  (select id from sample_photo) as photo_id,
  (select id from sample_notification) as notification_id;

select 'validation-context' as tag, *
from validation_context;

select set_config(
  'request.jwt.claim.sub',
  coalesce((select viewer_id::text from validation_context), ''),
  true
);

select set_config('request.jwt.claim.role', 'authenticated', true);

explain (analyze, buffers, verbose)
select public.home_feed_projection(
  viewer_id := (select viewer_id from validation_context),
  cursor := null,
  limit_count := 12,
  since := null,
  source_filter := 'all',
  type_filter := 'all',
  entity_filter := 'all',
  sort_mode := 'newest',
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.notifications_projection(
  viewer_id := (select viewer_id from validation_context),
  filter_name := 'all',
  cursor := null,
  limit_count := 15,
  since := null,
  delta_token := null,
  notification_id := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.notification_badge_projection(
  viewer_id := (select viewer_id from validation_context),
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.profile_overview_projection(
  viewer_id := (select viewer_id from validation_context),
  target_username := (select profile_username from validation_context),
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.profile_content_projection(
  viewer_id := (select viewer_id from validation_context),
  target_username := (select profile_username from validation_context),
  tab_name := 'events',
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.profile_content_projection(
  viewer_id := (select viewer_id from validation_context),
  target_username := (select profile_username from validation_context),
  tab_name := 'album',
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.relationship_list_projection(
  viewer_id := (select viewer_id from validation_context),
  target_username := (select profile_username from validation_context),
  kind_name := 'followers',
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.club_members_projection(
  viewer_id := (select viewer_id from validation_context),
  target_username := (select club_username from validation_context),
  cursor := null,
  limit_count := 20,
  since := null,
  include_requests := true,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.search_results_projection(
  viewer_id := (select viewer_id from validation_context),
  kind_name := 'events',
  query_text := 'kampus',
  category_filter := null,
  university_filter := null,
  fee_filter := null,
  visibility_filter := null,
  sort_mode := 'newest',
  cursor := null,
  limit_count := 12,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.search_results_projection(
  viewer_id := (select viewer_id from validation_context),
  kind_name := 'clubs',
  query_text := 'kulup',
  category_filter := null,
  university_filter := null,
  fee_filter := null,
  visibility_filter := null,
  sort_mode := 'newest',
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.event_detail_projection(
  viewer_id := (select viewer_id from validation_context),
  target_event_id := (select event_id from validation_context),
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.album_event_projection(
  viewer_id := (select viewer_id from validation_context),
  target_event_id := (select event_id from validation_context),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.blocked_users_projection(
  viewer_id := (select viewer_id from validation_context),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.event_comments_projection(
  viewer_id := (select viewer_id from validation_context),
  target_event_id := (select event_id from validation_context),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.event_likers_projection(
  viewer_id := (select viewer_id from validation_context),
  target_event_id := (select event_id from validation_context),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.event_attendees_projection(
  viewer_id := (select viewer_id from validation_context),
  target_event_id := (select event_id from validation_context),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

explain (analyze, buffers, verbose)
select public.album_comments_projection(
  viewer_id := (select viewer_id from validation_context),
  photo_id := (select photo_id from validation_context),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from validation_context;

rollback;
