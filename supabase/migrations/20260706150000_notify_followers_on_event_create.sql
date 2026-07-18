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

drop trigger if exists notify_followers_after_event_insert on public.events;
create trigger notify_followers_after_event_insert
after insert on public.events
for each row execute function public.notify_followers_on_event_insert();
