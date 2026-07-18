-- Canonical baseline migration.
-- Sources:
--   - 20260307205000_comment_likes_and_projection_support.sql

create table if not exists public.event_comment_likes (
  comment_id uuid not null references public.event_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (comment_id, user_id)
);
create table if not exists public.album_photo_comment_likes (
  comment_id uuid not null references public.album_photo_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (comment_id, user_id)
);
create index if not exists idx_event_comment_likes_comment_created
  on public.event_comment_likes (comment_id, created_at desc);
create index if not exists idx_event_comment_likes_user
  on public.event_comment_likes (user_id);
create index if not exists idx_album_photo_comment_likes_comment_created
  on public.album_photo_comment_likes (comment_id, created_at desc);
create index if not exists idx_album_photo_comment_likes_user
  on public.album_photo_comment_likes (user_id);
alter table public.event_comment_likes enable row level security;
alter table public.album_photo_comment_likes enable row level security;
drop policy if exists "event_comment_likes_select_visible_comment" on public.event_comment_likes;
create policy "event_comment_likes_select_visible_comment"
on public.event_comment_likes
for select
using (
  exists (
    select 1
    from public.event_comments ec
    where ec.id = comment_id
      and public.can_view_event(ec.event_id)
  )
);
drop policy if exists "event_comment_likes_insert_self" on public.event_comment_likes;
create policy "event_comment_likes_insert_self"
on public.event_comment_likes
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.event_comments ec
    where ec.id = comment_id
      and public.can_view_event(ec.event_id)
  )
);
drop policy if exists "event_comment_likes_delete_self" on public.event_comment_likes;
create policy "event_comment_likes_delete_self"
on public.event_comment_likes
for delete
using (auth.uid() = user_id);
drop policy if exists "album_photo_comment_likes_select_visible_comment" on public.album_photo_comment_likes;
create policy "album_photo_comment_likes_select_visible_comment"
on public.album_photo_comment_likes
for select
using (
  exists (
    select 1
    from public.album_photo_comments apc
    join public.album_photos ap on ap.id = apc.photo_id
    where apc.id = comment_id
      and public.can_view_event(ap.event_id)
  )
);
drop policy if exists "album_photo_comment_likes_insert_self" on public.album_photo_comment_likes;
create policy "album_photo_comment_likes_insert_self"
on public.album_photo_comment_likes
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.album_photo_comments apc
    join public.album_photos ap on ap.id = apc.photo_id
    where apc.id = comment_id
      and public.can_view_event(ap.event_id)
  )
);
drop policy if exists "album_photo_comment_likes_delete_self" on public.album_photo_comment_likes;
create policy "album_photo_comment_likes_delete_self"
on public.album_photo_comment_likes
for delete
using (auth.uid() = user_id);
create or replace function public.touch_event_comment_from_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment_id uuid;
begin
  target_comment_id := coalesce(new.comment_id, old.comment_id);

  update public.event_comments
  set updated_at = timezone('utc', now())
  where id = target_comment_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
create or replace function public.touch_album_comment_from_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment_id uuid;
begin
  target_comment_id := coalesce(new.comment_id, old.comment_id);

  update public.album_photo_comments
  set updated_at = timezone('utc', now())
  where id = target_comment_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
create or replace function public.notify_event_comment_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  target_event_id uuid;
  comment_preview text;
begin
  select
    ec.user_id,
    ec.event_id,
    left(regexp_replace(coalesce(ec.body, ''), '\s+', ' ', 'g'), 180)
  into owner_id, target_event_id, comment_preview
  from public.event_comments ec
  where ec.id = new.comment_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'like',
    'yorumunu begendi',
    comment_preview,
    target_event_id,
    null,
    null
  );

  return new;
end;
$$;
create or replace function public.notify_album_comment_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  target_event_id uuid;
  target_photo_id uuid;
  comment_preview text;
begin
  select
    apc.user_id,
    ap.event_id,
    apc.photo_id,
    left(regexp_replace(coalesce(apc.body, ''), '\s+', ' ', 'g'), 180)
  into owner_id, target_event_id, target_photo_id, comment_preview
  from public.album_photo_comments apc
  join public.album_photos ap on ap.id = apc.photo_id
  where apc.id = new.comment_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'like',
    'album yorumunu begendi',
    comment_preview,
    target_event_id,
    null,
    target_photo_id
  );

  return new;
end;
$$;
drop trigger if exists event_comment_likes_touch on public.event_comment_likes;
create trigger event_comment_likes_touch
after insert or delete on public.event_comment_likes
for each row execute function public.touch_event_comment_from_like();
drop trigger if exists album_photo_comment_likes_touch on public.album_photo_comment_likes;
create trigger album_photo_comment_likes_touch
after insert or delete on public.album_photo_comment_likes
for each row execute function public.touch_album_comment_from_like();
drop trigger if exists notify_event_comment_like_after_insert on public.event_comment_likes;
create trigger notify_event_comment_like_after_insert
after insert on public.event_comment_likes
for each row execute function public.notify_event_comment_like_insert();
drop trigger if exists notify_album_comment_like_after_insert on public.album_photo_comment_likes;
create trigger notify_album_comment_like_after_insert
after insert on public.album_photo_comment_likes
for each row execute function public.notify_album_comment_like_insert();
