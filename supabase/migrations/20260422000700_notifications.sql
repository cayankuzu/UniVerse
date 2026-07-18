-- Canonical baseline migration.
-- Sources:
--   - 20260304153000_engagement_toggle_rpcs.sql
--   - 20260305194000_notifications_triggers_and_read_single.sql
--   - 20260309183000_request_notifications_persist_and_lock.sql
--   - 20260310000000_request_resolution_single_row_authority.sql
--   - 20260314070000_follow_request_notification_canonicalization.sql
--   - 20260314113000_follow_notification_trigger_hardening.sql
--   - 20260326230000_home_notifications_hot_path_surgery.sql

create table if not exists public.notification_summary_cache (
  user_id uuid primary key,
  unread_count bigint not null default 0,
  latest_activity_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.notification_summary_cache enable row level security;
drop policy if exists "notification_summary_cache_select_owner"
  on public.notification_summary_cache;
create policy "notification_summary_cache_select_owner"
on public.notification_summary_cache
for select
using ((select auth.uid()) = user_id);
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type public.notification_type,
  p_message text,
  p_detail text default null,
  p_event_id uuid default null,
  p_target_profile_id uuid default null,
  p_photo_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
begin
  if p_user_id is null or p_actor_id is null then
    return;
  end if;

  if p_user_id = p_actor_id then
    return;
  end if;

  if public.is_blocked_pair(p_user_id, p_actor_id) then
    return;
  end if;

  if p_type in ('follow_request'::public.notification_type, 'join_request'::public.notification_type) then
    update public.notifications n
    set
      deleted_at = now_utc,
      is_read = true,
      last_activity_at = now_utc,
      sync_version = greatest(coalesce(n.sync_version, 1) + 1, 2)
    where n.user_id = p_user_id
      and n.actor_id is not distinct from p_actor_id
      and n.type = p_type
      and n.target_profile_id is not distinct from p_target_profile_id
      and n.deleted_at is null;
  elsif exists (
    select 1
    from public.notifications n
    where n.user_id = p_user_id
      and n.actor_id is not distinct from p_actor_id
      and n.type = p_type
      and n.event_id is not distinct from p_event_id
      and n.target_profile_id is not distinct from p_target_profile_id
      and n.photo_id is not distinct from p_photo_id
      and n.deleted_at is null
      and n.created_at >= now_utc - interval '8 seconds'
  ) then
    return;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    message,
    detail,
    event_id,
    target_profile_id,
    photo_id,
    request_status,
    request_resolved_at
  )
  values (
    p_user_id,
    p_actor_id,
    p_type,
    left(coalesce(p_message, ''), 250),
    nullif(left(coalesce(p_detail, ''), 1000), ''),
    p_event_id,
    p_target_profile_id,
    p_photo_id,
    case
      when p_type in ('follow_request'::public.notification_type, 'join_request'::public.notification_type)
        then 'pending'
      else null
    end,
    null
  );
end;
$$;
create or replace function public.resolve_request_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type public.notification_type,
  p_target_profile_id uuid,
  p_request_status text,
  p_resolution_text text default null,
  p_resolved_at timestamptz default timezone('utc', now())
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_notification_id uuid;
  resolved_at_utc timestamptz := coalesce(p_resolved_at, timezone('utc', now()));
begin
  if p_user_id is null or p_actor_id is null then
    return;
  end if;

  if p_request_status not in ('accepted', 'rejected') then
    return;
  end if;

  select n.id
    into target_notification_id
  from public.notifications n
  where n.user_id = p_user_id
    and n.actor_id is not distinct from p_actor_id
    and n.type = p_type
    and n.target_profile_id is not distinct from p_target_profile_id
    and n.deleted_at is null
  order by n.created_at desc, n.id desc
  limit 1;

  if target_notification_id is null then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      message,
      detail,
      target_profile_id,
      request_status,
      request_resolved_at,
      is_read,
      last_activity_at
    )
    values (
      p_user_id,
      p_actor_id,
      p_type,
      case
        when p_type = 'follow_request'::public.notification_type then 'takip istegi'
        else 'uyelik istegi'
      end,
      nullif(left(coalesce(p_resolution_text, ''), 1000), ''),
      p_target_profile_id,
      p_request_status,
      resolved_at_utc,
      true,
      resolved_at_utc
    )
    returning id into target_notification_id;
  else
    update public.notifications n
    set
      request_status = p_request_status,
      request_resolved_at = resolved_at_utc,
      is_read = true,
      detail = coalesce(nullif(left(coalesce(p_resolution_text, ''), 1000), ''), n.detail),
      last_activity_at = resolved_at_utc,
      sync_version = greatest(coalesce(n.sync_version, 1) + 1, 2)
    where n.id = target_notification_id;
  end if;

  delete from public.notifications n
  where n.deleted_at is null
    and n.user_id = p_user_id
    and n.actor_id is not distinct from p_actor_id
    and n.type = p_type
    and n.target_profile_id is not distinct from p_target_profile_id
    and n.id <> target_notification_id;
end;
$$;
create or replace function public.dequeue_notifications(
  p_user_id uuid default null,
  p_actor_id uuid default null,
  p_type public.notification_type default null,
  p_event_id uuid default null,
  p_target_profile_id uuid default null,
  p_photo_id uuid default null,
  p_detail text default null,
  p_limit integer default 1
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
  max_rows integer;
begin
  max_rows := greatest(coalesce(p_limit, 1), 1);

  with candidates as (
    select n.id
    from public.notifications n
    where (p_user_id is null or n.user_id = p_user_id)
      and (p_actor_id is null or n.actor_id is not distinct from p_actor_id)
      and (p_type is null or n.type = p_type)
      and (p_event_id is null or n.event_id is not distinct from p_event_id)
      and (p_target_profile_id is null or n.target_profile_id is not distinct from p_target_profile_id)
      and (p_photo_id is null or n.photo_id is not distinct from p_photo_id)
      and (p_detail is null or n.detail is not distinct from p_detail)
      and (
        p_type is null
        or p_type not in ('follow_request'::public.notification_type, 'join_request'::public.notification_type)
        or coalesce(n.request_status, 'pending') = 'pending'
      )
    order by n.created_at desc
    limit max_rows
  )
  delete from public.notifications n
  using candidates c
  where n.id = c.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
create or replace function public.mark_notification_read(target_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
begin
  viewer_id := auth.uid();
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if target_notification_id is null then
    return false;
  end if;

  update public.notifications
  set is_read = true
  where id = target_notification_id
    and user_id = viewer_id;

  return found;
end;
$$;
create or replace function public.mark_notifications_read_all()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  updated_count bigint;
begin
  viewer_id := auth.uid();
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  update public.notifications
  set is_read = true
  where user_id = viewer_id
    and is_read = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
create or replace function public.rebuild_notification_summary_cache(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  unread_total bigint := 0;
  latest_activity timestamptz := null;
begin
  if target_user_id is null then
    return;
  end if;

  select
    coalesce(count(*) filter (where n.is_read = false and n.deleted_at is null), 0)::bigint,
    max(coalesce(n.last_activity_at, n.created_at))
  into unread_total, latest_activity
  from public.notifications n
  where n.user_id = target_user_id
    and n.deleted_at is null;

  if unread_total = 0 and latest_activity is null then
    delete from public.notification_summary_cache
    where user_id = target_user_id;
    return;
  end if;

  insert into public.notification_summary_cache (
    user_id,
    unread_count,
    latest_activity_at,
    updated_at
  )
  values (
    target_user_id,
    unread_total,
    latest_activity,
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set unread_count = excluded.unread_count,
      latest_activity_at = excluded.latest_activity_at,
      updated_at = excluded.updated_at;
end;
$$;
create or replace function public.sync_notification_summary_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_notification_summary_cache(old.user_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.rebuild_notification_summary_cache(old.user_id);
  end if;

  perform public.rebuild_notification_summary_cache(new.user_id);
  return new;
end;
$$;
create or replace function public.notify_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.status = 'pending'::public.follow_status then
      perform public.enqueue_notification(
        new.following_id,
        new.follower_id,
        'follow_request'::public.notification_type,
        'seni takip etmek istiyor',
        null,
        null,
        new.follower_id,
        null
      );
    elsif new.status = 'accepted'::public.follow_status then
      perform public.enqueue_notification(
        new.following_id,
        new.follower_id,
        'follow'::public.notification_type,
        'seni takip etti',
        null,
        null,
        new.follower_id,
        null
      );
    end if;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;
create or replace function public.notify_follow_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if old.status = 'pending'::public.follow_status
      and new.status = 'accepted'::public.follow_status then
      perform public.enqueue_notification(
        new.follower_id,
        new.following_id,
        'follow_accepted'::public.notification_type,
        'takip istegini kabul etti',
        null,
        null,
        new.following_id,
        null
      );
    end if;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;
create or replace function public.notify_follow_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if old.deleted_at is null and new.deleted_at is not null then
      if old.status = 'pending'::public.follow_status then
        perform public.dequeue_notifications(
          old.following_id,
          old.follower_id,
          'follow_request'::public.notification_type,
          null,
          old.follower_id,
          null,
          null,
          1
        );
      elsif old.status = 'accepted'::public.follow_status then
        perform public.dequeue_notifications(
          old.following_id,
          old.follower_id,
          'follow'::public.notification_type,
          null,
          old.follower_id,
          null,
          null,
          1
        );
        perform public.dequeue_notifications(
          old.follower_id,
          old.following_id,
          'follow_accepted'::public.notification_type,
          null,
          old.following_id,
          null,
          null,
          1
        );
      end if;
    end if;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;
drop trigger if exists notifications_summary_cache_sync on public.notifications;
create trigger notifications_summary_cache_sync
after insert or update of user_id, is_read, deleted_at, last_activity_at or delete
on public.notifications
for each row
execute function public.sync_notification_summary_cache();
create or replace view public.notification_summary as
select
  cache.user_id,
  cache.unread_count,
  cache.latest_activity_at
from public.notification_summary_cache cache;
alter view public.notification_summary
  set (security_invoker = true);
drop trigger if exists notify_follow_insert on public.follows;
create trigger notify_follow_insert
after insert on public.follows
for each row execute function public.notify_follow_insert();
drop trigger if exists notify_follow_status_update on public.follows;
create trigger notify_follow_status_update
after update of status on public.follows
for each row
when (old.status is distinct from new.status)
execute function public.notify_follow_status_update();
drop trigger if exists notify_follow_soft_delete on public.follows;
create trigger notify_follow_soft_delete
after update of deleted_at on public.follows
for each row
when (old.deleted_at is distinct from new.deleted_at)
execute function public.notify_follow_soft_delete();
grant execute on function public.enqueue_notification(uuid, uuid, public.notification_type, text, text, uuid, uuid, uuid) to service_role;
grant execute on function public.resolve_request_notification(uuid, uuid, public.notification_type, uuid, text, text, timestamptz) to service_role;
grant execute on function public.dequeue_notifications(uuid, uuid, public.notification_type, uuid, uuid, uuid, text, integer) to service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_notifications_read_all() to authenticated;
