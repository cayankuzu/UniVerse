-- Canonical baseline migration.
-- Final follow-only relationship model plus membership compatibility stubs.
-- Sources:
--   - 20260310010000_membership_request_accept_authority_fix.sql
--   - 20260310030000_follow_only_remove_membership_system.sql
--   - 20260313234000_clubs_always_public_follow_direct.sql
--   - 20260314083000_follow_request_withdrawn_state_authority.sql

create or replace function public.get_membership_state(
  target_club_id uuid default null,
  target_username text default null
)
returns table(
  resolved_club_id uuid,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      target_club_id,
      (
        select p.user_id
        from public.profiles p
        where lower(btrim(coalesce(p.username, ''))) = lower(btrim(coalesce(target_username, '')))
          and p.account_type = 'club'
          and p.deleted_at is null
        limit 1
      )
    ) as resolved_club_id,
    'none'::text as status;
$$;
create or replace function public.get_membership_pair_state(
  target_club_id uuid,
  target_member_id uuid
)
returns table(
  resolved_club_id uuid,
  resolved_member_id uuid,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select target_club_id, target_member_id, 'none'::text;
$$;
create or replace function public.toggle_club_membership(target_club_id uuid)
returns table(status text)
language sql
security definer
set search_path = public
as $$
  select 'none'::text as status;
$$;
create or replace function public.respond_membership_request(club_id uuid, requester_id uuid, action text)
returns table(status text)
language sql
security definer
set search_path = public
as $$
  select 'none'::text as status;
$$;
create or replace function public.remove_club_member(club_id uuid, member_id uuid)
returns table(status text)
language sql
security definer
set search_path = public
as $$
  select 'none'::text as status;
$$;
create or replace function public.respond_follow_request(requester_id uuid, action text)
returns table(status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  pending_row_id uuid;
  latest_status public.follow_status;
  latest_deleted_at timestamptz;
  now_utc timestamptz := timezone('utc', now());
begin
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if action not in ('accept', 'reject') then
    raise exception 'Invalid action';
  end if;

  select f.id
    into pending_row_id
  from public.follows f
  where f.follower_id = requester_id
    and f.following_id = viewer_id
    and f.status = 'pending'::public.follow_status
    and f.deleted_at is null
  order by f.created_at desc, f.id desc
  limit 1;

  if pending_row_id is null then
    select f.status, f.deleted_at
      into latest_status, latest_deleted_at
    from public.follows f
    where f.follower_id = requester_id
      and f.following_id = viewer_id
    order by f.created_at desc, f.id desc
    limit 1;

    if latest_status = 'accepted'::public.follow_status and latest_deleted_at is null then
      if action = 'reject' then
        raise exception 'Follow request already accepted';
      end if;

      perform public.resolve_request_notification(
        viewer_id,
        requester_id,
        'follow_request'::public.notification_type,
        requester_id,
        'accepted',
        'Takip istegi zaten kabul edildi.',
        now_utc
      );
      status := 'following';
      return next;
    end if;

    if action = 'reject' then
      perform public.resolve_request_notification(
        viewer_id,
        requester_id,
        'follow_request'::public.notification_type,
        requester_id,
        'rejected',
        'Takip istegi artik aktif degil.',
        now_utc
      );
      status := 'none';
      return next;
    end if;

    raise exception 'Follow request not found';
  end if;

  if action = 'accept' then
    update public.follows
    set
      status = 'accepted'::public.follow_status,
      responded_at = now_utc,
      last_activity_at = now_utc,
      sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
    where id = pending_row_id;

    perform public.resolve_request_notification(
      viewer_id,
      requester_id,
      'follow_request'::public.notification_type,
      requester_id,
      'accepted',
      'Takip istegini kabul ettin.',
      now_utc
    );

    status := 'following';
    return next;
  end if;

  perform public.resolve_request_notification(
    viewer_id,
    requester_id,
    'follow_request'::public.notification_type,
    requester_id,
    'rejected',
    'Takip istegini reddettin.',
    now_utc
  );

  update public.follows
  set
    responded_at = now_utc,
    deleted_at = now_utc,
    last_activity_at = now_utc,
    sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
  where id = pending_row_id;

  status := 'none';
  return next;
end;
$$;
create or replace function public.set_follow_status(
  target_user_id uuid,
  desired_status text
)
returns table(status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_private boolean;
  target_account_type public.account_type;
  current_row_id uuid;
  next_raw_status public.follow_status;
  normalized_desired text := lower(trim(coalesce(desired_status, '')));
  now_utc timestamptz := timezone('utc', now());
  resolved_pending_request boolean := false;
begin
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if viewer_id = target_user_id then
    raise exception 'Cannot follow yourself';
  end if;

  if normalized_desired not in ('none', 'requested', 'following') then
    raise exception 'Invalid desired status';
  end if;

  if public.is_blocked_pair(viewer_id, target_user_id) then
    raise exception 'Blocked users cannot follow each other';
  end if;

  select p.account_type, p.is_private
    into target_account_type, target_private
  from public.profiles p
  where p.user_id = target_user_id
    and p.deleted_at is null;

  if target_account_type is null then
    raise exception 'Target profile not found';
  end if;

  if target_account_type = 'club'::public.account_type then
    target_private := false;
  end if;

  if normalized_desired = 'none' then
    select exists(
      select 1
      from public.follows f
      where f.follower_id = viewer_id
        and f.following_id = target_user_id
        and f.status = 'pending'::public.follow_status
        and f.deleted_at is null
    )
      into resolved_pending_request;

    update public.follows f
    set
      deleted_at = now_utc,
      last_activity_at = now_utc,
      responded_at = case
        when f.status in ('accepted'::public.follow_status, 'pending'::public.follow_status)
          then coalesce(f.responded_at, now_utc)
        else f.responded_at
      end,
      sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
    where follower_id = viewer_id
      and following_id = target_user_id
      and deleted_at is null;

    if resolved_pending_request then
      perform public.resolve_request_notification(
        target_user_id,
        viewer_id,
        'follow_request'::public.notification_type,
        viewer_id,
        'rejected',
        'Takip istegi geri cekildi.',
        now_utc
      );
    end if;

    status := 'none';
    return next;
  end if;

  next_raw_status := case
    when target_private then 'pending'::public.follow_status
    else 'accepted'::public.follow_status
  end;

  select f.id
    into current_row_id
  from public.follows f
  where f.follower_id = viewer_id
    and f.following_id = target_user_id
    and f.deleted_at is null
  order by f.created_at desc, f.id desc
  limit 1;

  if current_row_id is not null then
    update public.follows
    set
      status = next_raw_status,
      responded_at = case
        when next_raw_status = 'accepted'::public.follow_status then coalesce(responded_at, now_utc)
        else null
      end,
      last_activity_at = now_utc,
      sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
    where id = current_row_id;
  else
    insert into public.follows (
      follower_id,
      following_id,
      status,
      responded_at,
      last_activity_at,
      deleted_at
    )
    values (
      viewer_id,
      target_user_id,
      next_raw_status,
      case when next_raw_status = 'accepted'::public.follow_status then now_utc else null end,
      now_utc,
      null
    )
    on conflict (follower_id, following_id)
    where deleted_at is null
    do update
    set
      status = excluded.status,
      deleted_at = null,
      responded_at = excluded.responded_at,
      last_activity_at = now_utc,
      sync_version = greatest(coalesce(public.follows.sync_version, 1) + 1, 2);
  end if;

  status := case
    when next_raw_status = 'pending'::public.follow_status then 'requested'
    else 'following'
  end;
  return next;
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
create or replace function public.toggle_follow(target_user_id uuid)
returns table(status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_private boolean;
  target_account_type public.account_type;
  current_row_id uuid;
  current_status public.follow_status;
  now_utc timestamptz := timezone('utc', now());
begin
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if viewer_id = target_user_id then
    raise exception 'Cannot follow yourself';
  end if;

  if public.is_blocked_pair(viewer_id, target_user_id) then
    raise exception 'Blocked users cannot follow each other';
  end if;

  select p.account_type, p.is_private
    into target_account_type, target_private
  from public.profiles p
  where p.user_id = target_user_id
    and p.deleted_at is null;

  if target_private is null then
    raise exception 'Target profile not found';
  end if;

  if target_account_type = 'club'::public.account_type then
    target_private := false;
  end if;

  select f.id, f.status
    into current_row_id, current_status
  from public.follows f
  where f.follower_id = viewer_id
    and f.following_id = target_user_id
    and f.deleted_at is null
  order by f.created_at desc, f.id desc
  limit 1;

  if current_row_id is not null then
    update public.follows
    set
      deleted_at = now_utc,
      last_activity_at = now_utc,
      responded_at = case
        when current_status = 'accepted'::public.follow_status then coalesce(responded_at, now_utc)
        else responded_at
      end,
      sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
    where id = current_row_id;

    status := 'none';
    return next;
  end if;

  insert into public.follows (
    follower_id,
    following_id,
    status,
    responded_at,
    last_activity_at,
    deleted_at
  )
  values (
    viewer_id,
    target_user_id,
    case
      when target_private then 'pending'::public.follow_status
      else 'accepted'::public.follow_status
    end,
    case when target_private then null else now_utc end,
    now_utc,
    null
  );

  status := case when target_private then 'requested' else 'following' end;
  return next;
end;
$$;
create or replace function public.update_profile_privacy(target_is_private boolean)
returns table(is_private boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_account_type public.account_type;
  next_private boolean := coalesce(target_is_private, false);
  now_utc timestamptz := timezone('utc', now());
begin
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select p.account_type
    into viewer_account_type
  from public.profiles p
  where p.user_id = viewer_id
    and p.deleted_at is null;

  if viewer_account_type is null then
    raise exception 'Profile not found';
  end if;

  if viewer_account_type = 'club'::public.account_type then
    next_private := false;
  end if;

  update public.profiles
  set
    is_private = next_private,
    updated_at = now_utc,
    updated_by = viewer_id,
    last_activity_at = now_utc,
    sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
  where user_id = viewer_id
    and deleted_at is null;

  if not found then
    raise exception 'Profile not found';
  end if;

  return query
  select next_private;
end;
$$;
grant execute on function public.get_membership_state(uuid, text) to authenticated;
grant execute on function public.get_membership_pair_state(uuid, uuid) to authenticated;
grant execute on function public.toggle_club_membership(uuid) to authenticated;
grant execute on function public.respond_membership_request(uuid, uuid, text) to authenticated;
grant execute on function public.remove_club_member(uuid, uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid, text) to authenticated;
grant execute on function public.set_follow_status(uuid, text) to authenticated;
grant execute on function public.get_follow_state(uuid, text) to authenticated;
grant execute on function public.toggle_follow(uuid) to authenticated;
grant execute on function public.update_profile_privacy(boolean) to authenticated;
