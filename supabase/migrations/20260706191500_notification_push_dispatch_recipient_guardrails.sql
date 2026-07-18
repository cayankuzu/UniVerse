create or replace function public.notify_followers_on_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_preview text;
begin
  event_preview := left(
    regexp_replace(coalesce(new.title, ''), '\s+', ' ', 'g'),
    180
  );

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    message,
    detail,
    event_id
  )
  select
    follower_profile.user_id,
    new.club_id,
    'event'::public.notification_type,
    'yeni etkinlik paylasti',
    event_preview,
    new.id
  from public.follows f
  join public.profiles follower_profile
    on follower_profile.user_id = f.follower_id
   and follower_profile.deleted_at is null
   and follower_profile.account_type = 'student'::public.account_type
  where f.following_id = new.club_id
    and f.status = 'accepted'::public.follow_status
    and f.deleted_at is null
    and not public.is_blocked_pair(f.follower_id, new.club_id)
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = f.follower_id
        and n.actor_id is not distinct from new.club_id
        and n.type = 'event'::public.notification_type
        and n.event_id is not distinct from new.id
        and n.photo_id is null
        and n.deleted_at is null
    );

  return new;
end;
$$;

create or replace function public.prune_notification_push_dispatch_queue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null
    or new.is_read = true
    or (
      new.type in ('follow_request'::public.notification_type, 'join_request'::public.notification_type)
      and coalesce(new.request_status, 'pending') <> 'pending'
    ) then
    delete from public.notification_push_dispatch_queue
    where notification_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists prune_notification_push_dispatch_queue_after_update on public.notifications;
create trigger prune_notification_push_dispatch_queue_after_update
after update of is_read, deleted_at, request_status on public.notifications
for each row
when (
  old.is_read is distinct from new.is_read
  or old.deleted_at is distinct from new.deleted_at
  or old.request_status is distinct from new.request_status
)
execute function public.prune_notification_push_dispatch_queue();
