-- Visibility and RLS parity validation pack
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
with sample as (
  select p.user_id, p.username
  from public.profiles p
  where p.is_private = true
  order by p.created_at desc nulls last, p.user_id desc
  limit 1
)
select
  'private_profile_owner_can_view',
  'true',
  public.can_view_profile(sample.user_id)::text,
  jsonb_build_object('target_user_id', sample.user_id, 'target_username', sample.username)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.user_id::text, true)) cfg;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    private_profile.user_id as target_user_id,
    private_profile.username as target_username,
    accepted.follower_id as viewer_id
  from public.profiles private_profile
  join public.follows accepted
    on accepted.following_id = private_profile.user_id
   and accepted.status = 'accepted'
   and accepted.deleted_at is null
  where private_profile.is_private = true
    and not public.is_blocked_pair(accepted.follower_id, private_profile.user_id)
  order by accepted.responded_at desc nulls last, accepted.follower_id desc
  limit 1
)
select
  'private_profile_accepted_follower_can_view',
  'true',
  public.can_view_profile(sample.target_user_id)::text,
  jsonb_build_object('viewer_id', sample.viewer_id, 'target_user_id', sample.target_user_id, 'target_username', sample.target_username)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    private_profile.user_id as target_user_id,
    private_profile.username as target_username,
    viewer.user_id as viewer_id
  from public.profiles private_profile
  join public.profiles viewer
    on viewer.user_id <> private_profile.user_id
  where private_profile.is_private = true
    and not exists (
      select 1
      from public.follows f
      where f.follower_id = viewer.user_id
        and f.following_id = private_profile.user_id
        and f.status = 'accepted'
        and f.deleted_at is null
    )
    and not public.is_blocked_pair(viewer.user_id, private_profile.user_id)
  order by private_profile.created_at desc nulls last, viewer.created_at desc nulls last
  limit 1
)
select
  'private_profile_non_follower_cannot_view',
  'false',
  public.can_view_profile(sample.target_user_id)::text,
  jsonb_build_object('viewer_id', sample.viewer_id, 'target_user_id', sample.target_user_id, 'target_username', sample.target_username)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    bl.blocker_id,
    bl.blocked_id
  from public.blocks bl
  order by bl.created_at desc nulls last, bl.blocker_id desc, bl.blocked_id desc
  limit 1
)
select
  'blocked_pair_profile_hidden',
  'false',
  public.can_view_profile(sample.blocked_id)::text,
  jsonb_build_object('viewer_id', sample.blocker_id, 'target_user_id', sample.blocked_id)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.blocker_id::text, true)) cfg;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    bl.blocker_id,
    bl.blocked_id
  from public.blocks bl
  order by bl.created_at desc nulls last, bl.blocker_id desc, bl.blocked_id desc
  limit 1
)
select
  'blocked_pair_profile_capabilities_hidden',
  'false',
  coalesce(caps.can_view_header, false)::text || '/' || coalesce(caps.can_view_content, false)::text,
  jsonb_build_object(
    'viewer_id', sample.blocker_id,
    'target_user_id', sample.blocked_id,
    'expected', jsonb_build_object('can_view_header', false, 'can_view_content', false)
  )
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.blocker_id::text, true)) cfg,
lateral (
  select *
  from public.get_profile_capabilities(sample.blocked_id)
) caps;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select e.id as event_id, e.club_id as viewer_id
  from public.events e
  where e.visibility = 'members_only'
    and e.deleted_at is null
  order by e.created_at desc nulls last, e.id desc
  limit 1
)
select
  'members_only_event_owner_can_open_detail',
  'true',
  coalesce(caps.can_open_event_detail, false)::text,
  jsonb_build_object('viewer_id', sample.viewer_id, 'event_id', sample.event_id)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
lateral (
  select *
  from public.get_event_capabilities(sample.event_id)
) caps;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    e.id as event_id,
    cm.member_id as viewer_id,
    e.club_id
  from public.events e
  join public.club_memberships cm
    on cm.club_id = e.club_id
   and cm.status = 'accepted'
   and cm.deleted_at is null
  where e.visibility = 'members_only'
    and e.deleted_at is null
    and not public.is_blocked_pair(cm.member_id, e.club_id)
  order by e.created_at desc nulls last, e.id desc
  limit 1
)
select
  'members_only_event_member_can_open_detail',
  'true',
  coalesce(caps.can_open_event_detail, false)::text,
  jsonb_build_object('viewer_id', sample.viewer_id, 'event_id', sample.event_id, 'club_id', sample.club_id)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
lateral (
  select *
  from public.get_event_capabilities(sample.event_id)
) caps;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    e.id as event_id,
    viewer.user_id as viewer_id,
    e.club_id
  from public.events e
  join public.profiles viewer
    on viewer.user_id <> e.club_id
  where e.visibility = 'members_only'
    and e.deleted_at is null
    and not exists (
      select 1
      from public.club_memberships cm
      where cm.club_id = e.club_id
        and cm.member_id = viewer.user_id
        and cm.status = 'accepted'
        and cm.deleted_at is null
    )
    and not exists (
      select 1
      from public.event_attendees ea
      where ea.event_id = e.id
        and ea.user_id = viewer.user_id
    )
    and not public.is_blocked_pair(viewer.user_id, e.club_id)
  order by e.created_at desc nulls last, viewer.created_at desc nulls last
  limit 1
)
select
  'members_only_event_non_member_cannot_open_detail',
  'false',
  coalesce(caps.can_open_event_detail, false)::text,
  jsonb_build_object('viewer_id', sample.viewer_id, 'event_id', sample.event_id, 'club_id', sample.club_id)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
lateral (
  select *
  from public.get_event_capabilities(sample.event_id)
) caps;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    bl.blocker_id as viewer_id,
    e.id as event_id,
    e.club_id
  from public.blocks bl
  join public.events e on e.club_id = bl.blocked_id
  where e.deleted_at is null
  order by e.created_at desc nulls last, e.id desc
  limit 1
)
select
  'blocked_pair_event_hidden',
  'false',
  public.can_view_event(sample.event_id)::text,
  jsonb_build_object('viewer_id', sample.viewer_id, 'event_id', sample.event_id, 'club_id', sample.club_id)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    club.user_id as club_id,
    club.username as club_username,
    student.user_id as student_id
  from public.profiles club
  join public.profiles student
    on student.account_type = 'student'
   and student.user_id <> club.user_id
  where club.account_type = 'club'
    and not public.is_blocked_pair(student.user_id, club.user_id)
  order by club.created_at desc nulls last, student.created_at desc nulls last
  limit 1
)
select
  'student_vs_club_capability_shape',
  'present',
  case
    when caps.can_view_header is not null
      and caps.can_view_content is not null
      and caps.can_view_members is not null
    then 'present'
    else 'missing'
  end,
  jsonb_build_object('viewer_id', sample.student_id, 'target_user_id', sample.club_id, 'club_username', sample.club_username)
from sample,
lateral (select set_config('request.jwt.claim.sub', sample.student_id::text, true)) cfg,
lateral (
  select *
  from public.get_profile_capabilities(sample.club_id)
) caps;

select check_name, expected, actual, context
from validation_results
where actual is distinct from expected
order by check_name;

rollback;
