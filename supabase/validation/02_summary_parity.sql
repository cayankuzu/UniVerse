-- Summary parity validation pack
-- Returns only mismatches. Empty result means parity passed for sampled data set.

begin;

set local statement_timeout = '30s';

with event_expected as (
  select
    e.id as entity_id,
    coalesce(l.likes_count, 0)::bigint as likes_count,
    coalesce(c.comments_count, 0)::bigint as comments_count,
    coalesce(a.attendees_count, 0)::bigint as attendees_count,
    coalesce(p.album_count, 0)::bigint as album_count,
    e.last_activity_at,
    e.sync_version
  from public.events e
  left join (
    select event_id, count(*) as likes_count
    from public.event_likes
    group by event_id
  ) l on l.event_id = e.id
  left join (
    select event_id, count(*) as comments_count
    from public.event_comments
    group by event_id
  ) c on c.event_id = e.id
  left join (
    select event_id, count(*) as attendees_count
    from public.event_attendees
    group by event_id
  ) a on a.event_id = e.id
  left join (
    select event_id, count(*) as album_count
    from public.album_photos
    where deleted_at is null
      and (
        coalesce(show_on_club_profile, show_on_profile, false)
        or coalesce(show_on_user_profile, show_on_profile, false)
      )
    group by event_id
  ) p on p.event_id = e.id
),
event_mismatches as (
  select 'event_summary.likes_count' as check_name, s.event_id::text as entity_id, s.likes_count::text as summary_value, e.likes_count::text as expected_value
  from public.event_summary s
  join event_expected e on e.entity_id = s.event_id
  where s.likes_count is distinct from e.likes_count
  union all
  select 'event_summary.comments_count', s.event_id::text, s.comments_count::text, e.comments_count::text
  from public.event_summary s
  join event_expected e on e.entity_id = s.event_id
  where s.comments_count is distinct from e.comments_count
  union all
  select 'event_summary.attendees_count', s.event_id::text, s.attendees_count::text, e.attendees_count::text
  from public.event_summary s
  join event_expected e on e.entity_id = s.event_id
  where s.attendees_count is distinct from e.attendees_count
  union all
  select 'event_summary.album_count', s.event_id::text, s.album_count::text, e.album_count::text
  from public.event_summary s
  join event_expected e on e.entity_id = s.event_id
  where s.album_count is distinct from e.album_count
  union all
  select 'event_summary.last_activity_at', s.event_id::text, s.last_activity_at::text, e.last_activity_at::text
  from public.event_summary s
  join event_expected e on e.entity_id = s.event_id
  where s.last_activity_at is distinct from e.last_activity_at
  union all
  select 'event_summary.sync_version', s.event_id::text, s.sync_version::text, e.sync_version::text
  from public.event_summary s
  join event_expected e on e.entity_id = s.event_id
  where s.sync_version is distinct from e.sync_version
),
album_expected as (
  select
    ap.id as entity_id,
    coalesce(l.likes_count, 0)::bigint as likes_count,
    coalesce(c.comments_count, 0)::bigint as comments_count,
    greatest(coalesce(array_length(ap.media_paths, 1), 1), 1)::integer as images_count,
    ap.last_activity_at,
    ap.sync_version
  from public.album_photos ap
  left join (
    select photo_id, count(*) as likes_count
    from public.album_photo_likes
    group by photo_id
  ) l on l.photo_id = ap.id
  left join (
    select photo_id, count(*) as comments_count
    from public.album_photo_comments
    group by photo_id
  ) c on c.photo_id = ap.id
  where ap.deleted_at is null
),
album_mismatches as (
  select 'album_summary.likes_count' as check_name, s.photo_id::text as entity_id, s.likes_count::text as summary_value, e.likes_count::text as expected_value
  from public.album_summary s
  join album_expected e on e.entity_id = s.photo_id
  where s.likes_count is distinct from e.likes_count
  union all
  select 'album_summary.comments_count', s.photo_id::text, s.comments_count::text, e.comments_count::text
  from public.album_summary s
  join album_expected e on e.entity_id = s.photo_id
  where s.comments_count is distinct from e.comments_count
  union all
  select 'album_summary.images_count', s.photo_id::text, s.images_count::text, e.images_count::text
  from public.album_summary s
  join album_expected e on e.entity_id = s.photo_id
  where s.images_count is distinct from e.images_count
  union all
  select 'album_summary.last_activity_at', s.photo_id::text, s.last_activity_at::text, e.last_activity_at::text
  from public.album_summary s
  join album_expected e on e.entity_id = s.photo_id
  where s.last_activity_at is distinct from e.last_activity_at
  union all
  select 'album_summary.sync_version', s.photo_id::text, s.sync_version::text, e.sync_version::text
  from public.album_summary s
  join album_expected e on e.entity_id = s.photo_id
  where s.sync_version is distinct from e.sync_version
),
profile_expected as (
  select
    p.user_id as entity_id,
    coalesce(followers.followers_count, 0)::bigint as followers_count,
    coalesce(following.following_count, 0)::bigint as following_count,
    coalesce(members.members_count, 0)::bigint as members_count,
    coalesce(events.events_count, 0)::bigint as events_count,
    coalesce(albums.albums_count, 0)::bigint as albums_count,
    coalesce(clubs.clubs_count, 0)::bigint as clubs_count,
    coalesce(unread.unread_notifications_count, 0)::bigint as unread_notifications_count,
    coalesce(follow_requests.pending_follow_requests_count, 0)::bigint as pending_follow_requests_count,
    coalesce(member_requests.pending_membership_requests_count, 0)::bigint as pending_membership_requests_count,
    p.last_activity_at,
    p.sync_version
  from public.profiles p
  left join (
    select following_id as user_id, count(*) as followers_count
    from public.follows
    where status = 'accepted' and deleted_at is null
    group by following_id
  ) followers on followers.user_id = p.user_id
  left join (
    select follower_id as user_id, count(*) as following_count
    from public.follows
    where status = 'accepted' and deleted_at is null
    group by follower_id
  ) following on following.user_id = p.user_id
  left join (
    select club_id as user_id, count(*) as members_count
    from public.club_memberships
    where status = 'accepted' and deleted_at is null
    group by club_id
  ) members on members.user_id = p.user_id
  left join (
    select club_id as user_id, count(*) as events_count
    from public.events
    where deleted_at is null
    group by club_id
  ) events on events.user_id = p.user_id
  left join (
    select user_id, count(*) as albums_count
    from public.album_photos
    where deleted_at is null
    group by user_id
  ) albums on albums.user_id = p.user_id
  left join (
    select member_id as user_id, count(*) as clubs_count
    from public.club_memberships
    where status = 'accepted' and deleted_at is null
    group by member_id
  ) clubs on clubs.user_id = p.user_id
  left join (
    select user_id, count(*) as unread_notifications_count
    from public.notifications
    where is_read = false and deleted_at is null
    group by user_id
  ) unread on unread.user_id = p.user_id
  left join (
    select following_id as user_id, count(*) as pending_follow_requests_count
    from public.follows
    where status = 'pending' and deleted_at is null
    group by following_id
  ) follow_requests on follow_requests.user_id = p.user_id
  left join (
    select club_id as user_id, count(*) as pending_membership_requests_count
    from public.club_memberships
    where status = 'pending' and deleted_at is null
    group by club_id
  ) member_requests on member_requests.user_id = p.user_id
),
profile_mismatches as (
  select 'profile_summary.followers_count' as check_name, s.user_id::text as entity_id, s.followers_count::text as summary_value, e.followers_count::text as expected_value
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.followers_count is distinct from e.followers_count
  union all
  select 'profile_summary.following_count', s.user_id::text, s.following_count::text, e.following_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.following_count is distinct from e.following_count
  union all
  select 'profile_summary.members_count', s.user_id::text, s.members_count::text, e.members_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.members_count is distinct from e.members_count
  union all
  select 'profile_summary.events_count', s.user_id::text, s.events_count::text, e.events_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.events_count is distinct from e.events_count
  union all
  select 'profile_summary.albums_count', s.user_id::text, s.albums_count::text, e.albums_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.albums_count is distinct from e.albums_count
  union all
  select 'profile_summary.clubs_count', s.user_id::text, s.clubs_count::text, e.clubs_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.clubs_count is distinct from e.clubs_count
  union all
  select 'profile_summary.unread_notifications_count', s.user_id::text, s.unread_notifications_count::text, e.unread_notifications_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.unread_notifications_count is distinct from e.unread_notifications_count
  union all
  select 'profile_summary.pending_follow_requests_count', s.user_id::text, s.pending_follow_requests_count::text, e.pending_follow_requests_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.pending_follow_requests_count is distinct from e.pending_follow_requests_count
  union all
  select 'profile_summary.pending_membership_requests_count', s.user_id::text, s.pending_membership_requests_count::text, e.pending_membership_requests_count::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.pending_membership_requests_count is distinct from e.pending_membership_requests_count
  union all
  select 'profile_summary.last_activity_at', s.user_id::text, s.last_activity_at::text, e.last_activity_at::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.last_activity_at is distinct from e.last_activity_at
  union all
  select 'profile_summary.sync_version', s.user_id::text, s.sync_version::text, e.sync_version::text
  from public.profile_summary s
  join profile_expected e on e.entity_id = s.user_id
  where s.sync_version is distinct from e.sync_version
),
notification_expected as (
  select
    n.user_id as entity_id,
    count(*) filter (where n.is_read = false and n.deleted_at is null)::bigint as unread_count,
    max(coalesce(n.last_activity_at, n.created_at)) as latest_activity_at
  from public.notifications n
  group by n.user_id
),
notification_mismatches as (
  select 'notification_summary.unread_count' as check_name, s.user_id::text as entity_id, s.unread_count::text as summary_value, e.unread_count::text as expected_value
  from public.notification_summary s
  join notification_expected e on e.entity_id = s.user_id
  where s.unread_count is distinct from e.unread_count
  union all
  select 'notification_summary.latest_activity_at', s.user_id::text, s.latest_activity_at::text, e.latest_activity_at::text
  from public.notification_summary s
  join notification_expected e on e.entity_id = s.user_id
  where s.latest_activity_at is distinct from e.latest_activity_at
)
select *
from (
  select * from event_mismatches
  union all
  select * from album_mismatches
  union all
  select * from profile_mismatches
  union all
  select * from notification_mismatches
) mismatches
order by check_name, entity_id;

rollback;
