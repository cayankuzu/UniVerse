-- Album visibility and social-state consistency validation pack
-- Returns only mismatches for sampled scenarios. Empty result means sampled parity passed.

begin;

set local statement_timeout = '30s';

create temporary table validation_results (
  check_name text not null,
  expected text not null,
  actual text not null,
  context jsonb not null
);

insert into validation_results (check_name, expected, actual, context)
with duplicate_pairs as (
  select follower_id, following_id
  from public.follows
  where deleted_at is null
  group by follower_id, following_id
  having count(*) > 1
),
counts as (
  select count(*)::bigint as duplicate_count
  from duplicate_pairs
)
select
  'follows_single_active_row_per_pair',
  '0',
  counts.duplicate_count::text,
  jsonb_build_object('table', 'follows')
from counts
where counts.duplicate_count > 0;

insert into validation_results (check_name, expected, actual, context)
with duplicate_pairs as (
  select club_id, member_id
  from public.club_memberships
  where deleted_at is null
  group by club_id, member_id
  having count(*) > 1
),
counts as (
  select count(*)::bigint as duplicate_count
  from duplicate_pairs
)
select
  'club_memberships_single_active_row_per_pair',
  '0',
  counts.duplicate_count::text,
  jsonb_build_object('table', 'club_memberships')
from counts
where counts.duplicate_count > 0;

insert into validation_results (check_name, expected, actual, context)
select
  'rejected_memberships_are_soft_deleted',
  '0',
  count(*)::text,
  jsonb_build_object('table', 'club_memberships')
from public.club_memberships cm
where cm.status = 'rejected'
  and cm.deleted_at is null
having count(*) > 0;

insert into validation_results (check_name, expected, actual, context)
select
  'club_profile_flag_implies_user_profile_flag',
  '0',
  count(*)::text,
  jsonb_build_object('table', 'album_photos')
from public.album_photos ap
where ap.deleted_at is null
  and coalesce(ap.show_on_club_profile, false)
  and not coalesce(ap.show_on_user_profile, false)
having count(*) > 0;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    p.user_id as club_id,
    p.username as club_username
  from public.profiles p
  join public.events e
    on e.club_id = p.user_id
   and e.deleted_at is null
  join public.album_photos ap
    on ap.event_id = e.id
   and ap.deleted_at is null
   and coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
  where p.account_type = 'club'
    and p.deleted_at is null
  group by p.user_id, p.username
  order by max(ap.created_at) desc nulls last, p.user_id desc
  limit 1
)
select
  'club_profile_visible_albums_count',
  raw_counts.album_count::text,
  projected_counts.album_count::text,
  jsonb_build_object(
    'club_id', sample.club_id,
    'club_username', sample.club_username
  )
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.club_id::text, true)) cfg,
lateral (
  select count(distinct ap.id)::bigint as album_count
  from public.album_photos ap
  join public.events e
    on e.id = ap.event_id
  where e.club_id = sample.club_id
    and ap.deleted_at is null
    and e.deleted_at is null
    and coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
) raw_counts,
lateral (
  select count(*)::bigint as album_count
  from public.list_profile_visible_albums(sample.club_id)
) projected_counts
where raw_counts.album_count is distinct from projected_counts.album_count;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    p.user_id as student_id,
    p.username as student_username
  from public.profiles p
  join public.album_photos ap
    on ap.user_id = p.user_id
   and ap.deleted_at is null
   and coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
  where p.account_type = 'student'
    and p.deleted_at is null
  group by p.user_id, p.username
  order by max(ap.created_at) desc nulls last, p.user_id desc
  limit 1
)
select
  'student_profile_visible_albums_count',
  raw_counts.album_count::text,
  projected_counts.album_count::text,
  jsonb_build_object(
    'student_id', sample.student_id,
    'student_username', sample.student_username
  )
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.student_id::text, true)) cfg,
lateral (
  select count(distinct ap.id)::bigint as album_count
  from public.album_photos ap
  where ap.user_id = sample.student_id
    and ap.deleted_at is null
    and coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
) raw_counts,
lateral (
  select count(*)::bigint as album_count
  from public.list_profile_visible_albums(sample.student_id)
) projected_counts
where raw_counts.album_count is distinct from projected_counts.album_count;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    ap.id as photo_id,
    p.user_id as viewer_id,
    p.username as club_username
  from public.profiles p
  join public.events e
    on e.club_id = p.user_id
   and e.deleted_at is null
  join public.album_photos ap
    on ap.event_id = e.id
   and ap.deleted_at is null
  where p.account_type = 'club'
    and p.deleted_at is null
    and nullif(trim(p.username), '') is not null
  order by ap.created_at desc nulls last, ap.id desc
  limit 1
)
select
  'album_search_projection_matches_club_username',
  'true',
  search_match.has_photo::text,
  jsonb_build_object(
    'viewer_id', sample.viewer_id,
    'photo_id', sample.photo_id,
    'query_text', sample.club_username
  )
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
lateral (
  select exists (
    select 1
    from jsonb_array_elements(
      public.search_results_projection(
        sample.viewer_id,
        'albums',
        sample.club_username,
        null,
        null,
        null,
        null,
        'newest',
        null,
        100,
        null
      )->'items'
    ) item
    where item->>'photo_id' = sample.photo_id::text
  ) as has_photo
) search_match
where search_match.has_photo is distinct from true;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    ap.id as photo_id,
    p.user_id as viewer_id,
    p.club_name
  from public.profiles p
  join public.events e
    on e.club_id = p.user_id
   and e.deleted_at is null
  join public.album_photos ap
    on ap.event_id = e.id
   and ap.deleted_at is null
  where p.account_type = 'club'
    and p.deleted_at is null
    and nullif(trim(p.club_name), '') is not null
  order by ap.created_at desc nulls last, ap.id desc
  limit 1
)
select
  'album_search_projection_matches_club_name',
  'true',
  search_match.has_photo::text,
  jsonb_build_object(
    'viewer_id', sample.viewer_id,
    'photo_id', sample.photo_id,
    'query_text', sample.club_name
  )
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
lateral (
  select exists (
    select 1
    from jsonb_array_elements(
      public.search_results_projection(
        sample.viewer_id,
        'albums',
        sample.club_name,
        null,
        null,
        null,
        null,
        'newest',
        null,
        100,
        null
      )->'items'
    ) item
    where item->>'photo_id' = sample.photo_id::text
  ) as has_photo
) search_match
where search_match.has_photo is distinct from true;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    f.follower_id as viewer_id,
    viewer.username as viewer_username
  from public.follows f
  join public.profiles viewer
    on viewer.user_id = f.follower_id
   and viewer.deleted_at is null
  join public.events e
    on e.club_id = f.following_id
   and e.deleted_at is null
  join public.album_photos ap
    on ap.event_id = e.id
   and ap.deleted_at is null
  where f.status = 'accepted'
    and f.deleted_at is null
  order by f.created_at desc nulls last, f.follower_id desc
  limit 1
)
select
  'home_feed_projection_album_count_matches_home_event_scope',
  visible_counts.album_count::text,
  projected_counts.album_count::text,
  jsonb_build_object(
    'viewer_id', sample.viewer_id,
    'viewer_username', sample.viewer_username
  )
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
lateral (
  select count(*)::bigint as album_count
  from public.list_visible_albums(
    'feed',
    null,
    (select array_agg(id) from public.list_home_feed_events())
  )
) visible_counts,
lateral (
  select count(*)::bigint as album_count
  from jsonb_array_elements(
    public.home_feed_projection(
      sample.viewer_id,
      null,
      200,
      null,
      'all',
      'all',
      'all'
    )->'items'
  ) item
  where item->>'kind' = 'album'
) projected_counts
where visible_counts.album_count is distinct from projected_counts.album_count;

select *
from validation_results
order by check_name;

rollback;
