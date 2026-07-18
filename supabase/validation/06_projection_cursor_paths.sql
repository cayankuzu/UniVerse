-- Cursor and append-path EXPLAIN ANALYZE pack
-- Run after the pagination performance migration in staging or production-like SQL context.

begin;

set local statement_timeout = '30s';

with sample_viewer as (
  select p.user_id, p.username
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
)
select 'cursor-validation-context' as tag,
  (select user_id from sample_viewer) as viewer_id,
  (select username from sample_viewer) as viewer_username;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
)
select public.home_feed_projection(
  viewer_id := (select user_id from sample_viewer),
  cursor := null,
  limit_count := 12,
  since := null,
  source_filter := 'all',
  type_filter := 'all',
  entity_filter := 'all',
  sort_mode := 'newest'
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
first_page as (
  select public.home_feed_projection(
    viewer_id := (select user_id from sample_viewer),
    cursor := null,
    limit_count := 12,
    since := null,
    source_filter := 'all',
    type_filter := 'all',
    entity_filter := 'all',
    sort_mode := 'newest'
  ) as payload
)
select public.home_feed_projection(
  viewer_id := (select user_id from sample_viewer),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 12,
  since := null,
  source_filter := 'all',
  type_filter := 'all',
  entity_filter := 'all',
  sort_mode := 'newest'
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
)
select public.home_feed_projection(
  viewer_id := (select user_id from sample_viewer),
  cursor := null,
  limit_count := 12,
  since := null,
  source_filter := 'all',
  type_filter := 'all',
  entity_filter := 'all',
  sort_mode := 'oldest'
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id, p.username
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
first_page as (
  select public.profile_content_projection(
    viewer_id := (select user_id from sample_viewer),
    target_username := (select username from sample_viewer),
    tab_name := 'events',
    cursor := null,
    limit_count := 12,
    since := null
  ) as payload
)
select public.profile_content_projection(
  viewer_id := (select user_id from sample_viewer),
  target_username := (select username from sample_viewer),
  tab_name := 'events',
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 12,
  since := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id, p.username
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
first_page as (
  select public.profile_content_projection(
    viewer_id := (select user_id from sample_viewer),
    target_username := (select username from sample_viewer),
    tab_name := 'album',
    cursor := null,
    limit_count := 12,
    since := null
  ) as payload
)
select public.profile_content_projection(
  viewer_id := (select user_id from sample_viewer),
  target_username := (select username from sample_viewer),
  tab_name := 'album',
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 12,
  since := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
first_page as (
  select public.search_results_projection(
    viewer_id := (select user_id from sample_viewer),
    kind_name := 'events',
    query_text := 'kampus',
    category_filter := null,
    university_filter := null,
    fee_filter := null,
    visibility_filter := null,
    sort_mode := 'newest',
    cursor := null,
    limit_count := 12,
    since := null
  ) as payload
)
select public.search_results_projection(
  viewer_id := (select user_id from sample_viewer),
  kind_name := 'events',
  query_text := 'kampus',
  category_filter := null,
  university_filter := null,
  fee_filter := null,
  visibility_filter := null,
  sort_mode := 'newest',
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 12,
  since := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
first_page as (
  select public.search_results_projection(
    viewer_id := (select user_id from sample_viewer),
    kind_name := 'albums',
    query_text := 'kampus',
    category_filter := null,
    university_filter := null,
    fee_filter := null,
    visibility_filter := null,
    sort_mode := 'newest',
    cursor := null,
    limit_count := 12,
    since := null
  ) as payload
)
select public.search_results_projection(
  viewer_id := (select user_id from sample_viewer),
  kind_name := 'albums',
  query_text := 'kampus',
  category_filter := null,
  university_filter := null,
  fee_filter := null,
  visibility_filter := null,
  sort_mode := 'newest',
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 12,
  since := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
first_page as (
  select public.search_results_projection(
    viewer_id := (select user_id from sample_viewer),
    kind_name := 'clubs',
    query_text := 'kulup',
    category_filter := null,
    university_filter := null,
    fee_filter := null,
    visibility_filter := null,
    sort_mode := 'newest',
    cursor := null,
    limit_count := 12,
    since := null
  ) as payload
)
select public.search_results_projection(
  viewer_id := (select user_id from sample_viewer),
  kind_name := 'clubs',
  query_text := 'kulup',
  category_filter := null,
  university_filter := null,
  fee_filter := null,
  visibility_filter := null,
  sort_mode := 'newest',
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 12,
  since := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
)
select public.blocked_users_projection(
  viewer_id := (select user_id from sample_viewer),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
first_page as (
  select public.blocked_users_projection(
    viewer_id := (select user_id from sample_viewer),
    cursor := null,
    limit_count := 20,
    since := null,
    delta_token := null
  ) as payload
)
select public.blocked_users_projection(
  viewer_id := (select user_id from sample_viewer),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
)
select public.album_event_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := null,
  limit_count := 12,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
),
first_page as (
  select public.album_event_projection(
    viewer_id := (select user_id from sample_viewer),
    target_event_id := (select id from sample_event),
    cursor := null,
    limit_count := 12,
    since := null,
    delta_token := null
  ) as payload
)
select public.album_event_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 12,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
)
select public.event_comments_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
),
first_page as (
  select public.event_comments_projection(
    viewer_id := (select user_id from sample_viewer),
    target_event_id := (select id from sample_event),
    cursor := null,
    limit_count := 20,
    since := null,
    delta_token := null
  ) as payload
)
select public.event_comments_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
)
select public.event_likers_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
),
first_page as (
  select public.event_likers_projection(
    viewer_id := (select user_id from sample_viewer),
    target_event_id := (select id from sample_event),
    cursor := null,
    limit_count := 20,
    since := null,
    delta_token := null
  ) as payload
)
select public.event_likers_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
)
select public.event_attendees_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event as (
  select e.id
  from public.events e
  where e.deleted_at is null
  order by e.last_activity_at desc nulls last, e.created_at desc nulls last, e.id desc
  limit 1
),
first_page as (
  select public.event_attendees_projection(
    viewer_id := (select user_id from sample_viewer),
    target_event_id := (select id from sample_event),
    cursor := null,
    limit_count := 20,
    since := null,
    delta_token := null
  ) as payload
)
select public.event_attendees_projection(
  viewer_id := (select user_id from sample_viewer),
  target_event_id := (select id from sample_event),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_photo as (
  select ap.id
  from public.album_photos ap
  where ap.deleted_at is null
  order by ap.last_activity_at desc nulls last, ap.created_at desc nulls last, ap.id desc
  limit 1
)
select public.album_comments_projection(
  viewer_id := (select user_id from sample_viewer),
  photo_id := (select id from sample_photo),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_photo as (
  select ap.id
  from public.album_photos ap
  where ap.deleted_at is null
  order by ap.last_activity_at desc nulls last, ap.created_at desc nulls last, ap.id desc
  limit 1
),
first_page as (
  select public.album_comments_projection(
    viewer_id := (select user_id from sample_viewer),
    photo_id := (select id from sample_photo),
    cursor := null,
    limit_count := 20,
    since := null,
    delta_token := null
  ) as payload
)
select public.album_comments_projection(
  viewer_id := (select user_id from sample_viewer),
  photo_id := (select id from sample_photo),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event_comment as (
  select ec.id
  from public.event_comments ec
  order by greatest(ec.updated_at, ec.created_at) desc nulls last, ec.created_at desc nulls last, ec.id desc
  limit 1
)
select public.event_comment_likers_projection(
  viewer_id := (select user_id from sample_viewer),
  target_comment_id := (select id from sample_event_comment),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_event_comment as (
  select ec.id
  from public.event_comments ec
  order by greatest(ec.updated_at, ec.created_at) desc nulls last, ec.created_at desc nulls last, ec.id desc
  limit 1
),
first_page as (
  select public.event_comment_likers_projection(
    viewer_id := (select user_id from sample_viewer),
    target_comment_id := (select id from sample_event_comment),
    cursor := null,
    limit_count := 20,
    since := null,
    delta_token := null
  ) as payload
)
select public.event_comment_likers_projection(
  viewer_id := (select user_id from sample_viewer),
  target_comment_id := (select id from sample_event_comment),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_album_comment as (
  select apc.id
  from public.album_photo_comments apc
  order by greatest(apc.updated_at, apc.created_at) desc nulls last, apc.created_at desc nulls last, apc.id desc
  limit 1
)
select public.album_comment_likers_projection(
  viewer_id := (select user_id from sample_viewer),
  target_comment_id := (select id from sample_album_comment),
  cursor := null,
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

explain (analyze, buffers, verbose)
with sample_viewer as (
  select p.user_id
  from public.profiles p
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
),
sample_album_comment as (
  select apc.id
  from public.album_photo_comments apc
  order by greatest(apc.updated_at, apc.created_at) desc nulls last, apc.created_at desc nulls last, apc.id desc
  limit 1
),
first_page as (
  select public.album_comment_likers_projection(
    viewer_id := (select user_id from sample_viewer),
    target_comment_id := (select id from sample_album_comment),
    cursor := null,
    limit_count := 20,
    since := null,
    delta_token := null
  ) as payload
)
select public.album_comment_likers_projection(
  viewer_id := (select user_id from sample_viewer),
  target_comment_id := (select id from sample_album_comment),
  cursor := nullif((select payload ->> 'next_cursor' from first_page), ''),
  limit_count := 20,
  since := null,
  delta_token := null
)
from sample_viewer;

rollback;
