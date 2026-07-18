-- Enforce Instagram-like blocking semantics for relationship, visibility,
-- and fallback profile surfaces.

create or replace function public.disconnect_blocked_follow_relationships(
  user_a uuid,
  user_b uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
begin
  if user_a is null or user_b is null or user_a = user_b then
    return;
  end if;

  update public.follows f
  set
    deleted_at = now_utc,
    responded_at = case
      when f.status in ('accepted'::public.follow_status, 'pending'::public.follow_status)
        then coalesce(f.responded_at, now_utc)
      else f.responded_at
    end,
    last_activity_at = now_utc,
    sync_version = greatest(coalesce(f.sync_version, 1) + 1, 2)
  where f.deleted_at is null
    and (
      (f.follower_id = user_a and f.following_id = user_b)
      or (f.follower_id = user_b and f.following_id = user_a)
    );

  perform public.dequeue_notifications(
    p_user_id := user_a,
    p_actor_id := user_b,
    p_type := 'follow_request'::public.notification_type,
    p_target_profile_id := user_b,
    p_limit := 20
  );

  perform public.dequeue_notifications(
    p_user_id := user_b,
    p_actor_id := user_a,
    p_type := 'follow_request'::public.notification_type,
    p_target_profile_id := user_a,
    p_limit := 20
  );
end;
$$;
create or replace function public.get_profile_capabilities(target_profile_id uuid)
returns table(
  can_view_header boolean,
  can_view_content boolean,
  can_view_followers boolean,
  can_view_following boolean,
  can_view_members boolean,
  can_view_joined_clubs boolean,
  locked_reason_code text,
  locked_reason_text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  target_account_type public.account_type;
  target_is_private boolean;
  target_hide_members boolean;
  target_hide_joined_clubs boolean;
  viewer_follows_target boolean := false;
  viewer_is_target_member boolean := false;
  target_is_viewer_member boolean := false;
  viewer_blocked_target boolean := false;
  target_blocked_viewer boolean := false;
  header_visible boolean := false;
  content_visible boolean := false;
  followers_visible boolean := false;
  following_visible boolean := false;
  members_visible boolean := false;
  joined_clubs_visible boolean := false;
  reason_code text := null;
  reason_text text := null;
begin
  viewer_id := auth.uid();

  select
    p.account_type,
    p.is_private,
    coalesce(p.hide_members_list, false),
    coalesce(p.hide_joined_clubs, false)
  into
    target_account_type,
    target_is_private,
    target_hide_members,
    target_hide_joined_clubs
  from public.profiles p
  where p.user_id = target_profile_id
    and p.deleted_at is null;

  if target_account_type is null then
    return query
    select false, false, false, false, false, false, 'NOT_FOUND', 'Profil bulunamadi.';
    return;
  end if;

  if target_account_type = 'club'::public.account_type then
    target_is_private := false;
  end if;

  if viewer_id is not null then
    select
      exists (
        select 1
        from public.blocks bl
        where bl.blocker_id = viewer_id
          and bl.blocked_id = target_profile_id
      ),
      exists (
        select 1
        from public.blocks bl
        where bl.blocker_id = target_profile_id
          and bl.blocked_id = viewer_id
      )
    into
      viewer_blocked_target,
      target_blocked_viewer;
  end if;

  if target_blocked_viewer then
    return query
    select false, false, false, false, false, false, 'BLOCKED', 'Bu profile erisemiyorsunuz.';
    return;
  end if;

  if viewer_blocked_target then
    return query
    select false, false, false, false, false, false, 'BLOCKED_BY_VIEWER', 'Bu kullaniciyi engellediniz.';
    return;
  end if;

  header_visible := true;

  if viewer_id = target_profile_id then
    return query
    select true, true, true, true, true, true, null::text, null::text;
    return;
  end if;

  if viewer_id is not null then
    viewer_follows_target := public.is_accepted_follower(viewer_id, target_profile_id);

    if target_account_type = 'club'::public.account_type then
      viewer_is_target_member := exists (
        select 1
        from public.club_memberships cm
        where cm.club_id = target_profile_id
          and cm.member_id = viewer_id
          and cm.status = 'accepted'::public.membership_status
          and cm.deleted_at is null
      );
    else
      target_is_viewer_member := exists (
        select 1
        from public.club_memberships cm
        where cm.club_id = viewer_id
          and cm.member_id = target_profile_id
          and cm.status = 'accepted'::public.membership_status
          and cm.deleted_at is null
      );
    end if;
  end if;

  if target_is_private = false then
    content_visible := true;
    followers_visible := true;
    following_visible := true;
    members_visible := true;
    joined_clubs_visible := true;
  elsif viewer_id is not null and (
    viewer_follows_target
    or viewer_is_target_member
    or target_is_viewer_member
  ) then
    content_visible := true;
    followers_visible := true;
    following_visible := true;
    members_visible := not target_hide_members;
    joined_clubs_visible := not target_hide_joined_clubs;
  else
    reason_code := 'PRIVATE_PROFILE';
    reason_text := 'Bu kullanicinin hesabi gizli.';
  end if;

  return query
  select
    header_visible,
    content_visible,
    followers_visible,
    following_visible,
    members_visible,
    joined_clubs_visible,
    reason_code,
    reason_text;
end;
$$;
create or replace function public.get_follow_state(
  target_user_id uuid default null,
  target_username text default null
)
returns table(
  resolved_user_id uuid,
  status text,
  is_private boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_id uuid := target_user_id;
  raw_status public.follow_status;
  target_private boolean;
  target_account_type public.account_type;
begin
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if target_id is null and btrim(coalesce(target_username, '')) <> '' then
    select p.user_id
      into target_id
    from public.profiles p
    where lower(btrim(p.username)) = lower(btrim(target_username))
      and p.deleted_at is null
    limit 1;
  end if;

  if target_id is null then
    return query
    select null::uuid, 'none'::text, false;
    return;
  end if;

  select p.account_type, p.is_private
    into target_account_type, target_private
  from public.profiles p
  where p.user_id = target_id
    and p.deleted_at is null
  limit 1;

  if target_account_type = 'club'::public.account_type then
    target_private := false;
  end if;

  if public.is_blocked_pair(viewer_id, target_id) then
    return query
    select target_id, 'none'::text, coalesce(target_private, false);
    return;
  end if;

  select f.status
    into raw_status
  from public.follows f
  where f.follower_id = viewer_id
    and f.following_id = target_id
    and f.deleted_at is null
  order by f.created_at desc, f.id desc
  limit 1;

  return query
  select
    target_id,
    case
      when raw_status = 'accepted'::public.follow_status then 'following'
      when raw_status = 'pending'::public.follow_status then 'requested'
      else 'none'
    end,
    coalesce(target_private, false);
end;
$$;
create or replace function public.block_user_with_patch(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_user_id uuid;
begin
  if viewer_id is null then
    raise exception 'unauthorized';
  end if;

  select p.user_id
    into target_user_id
  from public.profiles p
  where lower(trim(p.username)) = lower(trim(coalesce(target_username, '')))
  limit 1;

  if target_user_id is null then
    raise exception 'profile-not-found';
  end if;

  if viewer_id = target_user_id then
    raise exception 'cannot-block-yourself';
  end if;

  if not exists (
    select 1
    from public.blocks b
    where b.blocker_id = viewer_id and b.blocked_id = target_user_id
  ) then
    insert into public.blocks (blocker_id, blocked_id)
    values (viewer_id, target_user_id);
  end if;

  perform public.disconnect_blocked_follow_relationships(viewer_id, target_user_id);

  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.relationship_list_projection(
  viewer_id uuid,
  target_username text,
  kind_name text,
  cursor text,
  limit_count integer,
  since timestamptz,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with resolved_viewer as (
    select coalesce(viewer_id, auth.uid()) as uid
  ),
  resolved_params as (
    select
      least(greatest(coalesce(limit_count, 60), 1), 120) as effective_limit,
      public.resolve_projection_since(since, delta_token) as resolved_since
  ),
  target_profile as (
    select p.user_id
    from public.profiles p
    where lower(trim(coalesce(p.username, ''))) = lower(trim(coalesce(target_username, '')))
      and p.deleted_at is null
  ),
  caps as (
    select *
    from public.get_profile_capabilities((select user_id from target_profile))
  ),
  base_rows as (
    select
      case when kind_name = 'followers' then f.follower_id else f.following_id end as relation_user_id,
      f.created_at,
      f.last_activity_at
    from public.follows f
    join target_profile tp on (
      (kind_name = 'followers' and f.following_id = tp.user_id) or
      (kind_name <> 'followers' and f.follower_id = tp.user_id)
    )
    cross join resolved_params rp
    where f.status = 'accepted'::public.follow_status
      and f.deleted_at is null
      and (
        (kind_name = 'followers' and coalesce((select can_view_followers from caps), false)) or
        (kind_name <> 'followers' and coalesce((select can_view_following from caps), false))
      )
      and not public.is_blocked_pair(
        (select uid from resolved_viewer),
        case when kind_name = 'followers' then f.follower_id else f.following_id end
      )
      and (rp.resolved_since is null or f.last_activity_at >= rp.resolved_since)
    order by f.last_activity_at desc, relation_user_id desc
    limit (select effective_limit from resolved_params)
  ),
  rows as (
    select
      br.relation_user_id,
      br.created_at,
      p.username,
      coalesce(p.name, p.club_name, p.username::text) as display_name,
      coalesce(p.profile_image_path, '') as image,
      coalesce(p.cover_image_path, '') as cover_image,
      coalesce(p.university, '') as university,
      p.account_type,
      p.is_private,
      p.department,
      p.grade_year,
      coalesce(p.categories, '{}'::text[]) as categories,
      p.bio,
      p.description,
      case
        when viewer_follow.status = 'accepted'::public.follow_status then 'following'
        when viewer_follow.status = 'pending'::public.follow_status then 'requested'
        else 'none'
      end as viewer_follow_status
    from base_rows br
    join public.profiles p on p.user_id = br.relation_user_id
    left join resolved_viewer rv on true
    left join public.follows viewer_follow
      on viewer_follow.follower_id = rv.uid
     and viewer_follow.following_id = br.relation_user_id
     and viewer_follow.deleted_at is null
  )
  select public.build_projection_envelope(
    items := coalesce(jsonb_agg(
      jsonb_build_object(
        'id', r.relation_user_id,
        'userId', r.relation_user_id,
        'username', r.username::text,
        'name', r.display_name,
        'image', r.image,
        'profileImage', r.image,
        'coverImage', r.cover_image,
        'university', r.university,
        'accountType', r.account_type::text,
        'account_type', r.account_type::text,
        'time', public.display_projection_time(r.created_at),
        'isPrivate', r.is_private,
        'department', r.department,
        'year', r.grade_year,
        'category', case when coalesce(array_length(r.categories, 1), 0) > 0 then r.categories[1] else null end,
        'categories', to_jsonb(r.categories),
        'bio', r.bio,
        'description', r.description,
        'viewerFollowStatus', r.viewer_follow_status
      )
      order by r.created_at desc, r.relation_user_id desc
    ), '[]'::jsonb),
    next_cursor := null,
    server_time := timezone('utc', now()),
    delta_token := timezone('utc', now())
  )
  from rows r;
$$;
do $$
declare
  block_row record;
begin
  for block_row in
    select b.blocker_id, b.blocked_id
    from public.blocks b
  loop
    perform public.disconnect_blocked_follow_relationships(
      block_row.blocker_id,
      block_row.blocked_id
    );
  end loop;
end;
$$;
grant execute on function public.disconnect_blocked_follow_relationships(uuid, uuid) to authenticated;
