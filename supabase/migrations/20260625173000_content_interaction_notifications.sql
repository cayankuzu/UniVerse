create or replace function public.notify_event_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  event_preview text;
begin
  select
    e.club_id,
    left(regexp_replace(coalesce(e.title, ''), '\s+', ' ', 'g'), 180)
  into owner_id, event_preview
  from public.events e
  where e.id = new.event_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'like'::public.notification_type,
    'etkinligini begendi',
    event_preview,
    new.event_id,
    null,
    null
  );

  return new;
end;
$$;
create or replace function public.notify_event_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  event_preview text;
begin
  select
    e.club_id,
    left(regexp_replace(coalesce(e.title, ''), '\s+', ' ', 'g'), 180)
  into owner_id, event_preview
  from public.events e
  where e.id = new.event_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'event'::public.notification_type,
    'etkinligine katildi',
    event_preview,
    new.event_id,
    null,
    null
  );

  return new;
end;
$$;
create or replace function public.notify_event_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  parent_owner_id uuid;
  comment_preview text;
  event_preview text;
begin
  select
    e.club_id,
    parent.user_id,
    left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 180),
    left(regexp_replace(coalesce(e.title, ''), '\s+', ' ', 'g'), 180)
  into owner_id, parent_owner_id, comment_preview, event_preview
  from public.events e
  left join public.event_comments parent on parent.id = new.parent_id
  where e.id = new.event_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'comment'::public.notification_type,
    'etkinligine yorum yapti',
    coalesce(comment_preview, event_preview),
    new.event_id,
    null,
    null
  );

  if parent_owner_id is not null and parent_owner_id <> owner_id then
    perform public.enqueue_notification(
      parent_owner_id,
      new.user_id,
      'comment'::public.notification_type,
      'yorumuna yanit verdi',
      coalesce(comment_preview, event_preview),
      new.event_id,
      null,
      null
    );
  end if;

  return new;
end;
$$;
create or replace function public.notify_album_photo_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  album_preview text;
begin
  select
    e.club_id,
    left(
      regexp_replace(
        coalesce(nullif(new.title, ''), nullif(new.caption, ''), e.title, 'Album'),
        '\s+',
        ' ',
        'g'
      ),
      180
    )
  into owner_id, album_preview
  from public.events e
  where e.id = new.event_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'event'::public.notification_type,
    'etkinligine album ekledi',
    album_preview,
    new.event_id,
    null,
    new.id
  );

  return new;
end;
$$;
create or replace function public.notify_album_photo_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  target_event_id uuid;
  album_preview text;
begin
  select
    ap.user_id,
    ap.event_id,
    left(
      regexp_replace(
        coalesce(nullif(ap.title, ''), nullif(ap.caption, ''), 'Album'),
        '\s+',
        ' ',
        'g'
      ),
      180
    )
  into owner_id, target_event_id, album_preview
  from public.album_photos ap
  where ap.id = new.photo_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'like'::public.notification_type,
    'albumunu begendi',
    album_preview,
    target_event_id,
    null,
    new.photo_id
  );

  return new;
end;
$$;
create or replace function public.notify_album_photo_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  parent_owner_id uuid;
  target_event_id uuid;
  comment_preview text;
  album_preview text;
begin
  select
    ap.user_id,
    parent.user_id,
    ap.event_id,
    left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 180),
    left(
      regexp_replace(
        coalesce(nullif(ap.title, ''), nullif(ap.caption, ''), 'Album'),
        '\s+',
        ' ',
        'g'
      ),
      180
    )
  into owner_id, parent_owner_id, target_event_id, comment_preview, album_preview
  from public.album_photos ap
  left join public.album_photo_comments parent on parent.id = new.parent_id
  where ap.id = new.photo_id;

  perform public.enqueue_notification(
    owner_id,
    new.user_id,
    'comment'::public.notification_type,
    'albumuna yorum yapti',
    coalesce(comment_preview, album_preview),
    target_event_id,
    null,
    new.photo_id
  );

  if parent_owner_id is not null and parent_owner_id <> owner_id then
    perform public.enqueue_notification(
      parent_owner_id,
      new.user_id,
      'comment'::public.notification_type,
      'album yorumuna yanit verdi',
      coalesce(comment_preview, album_preview),
      target_event_id,
      null,
      new.photo_id
    );
  end if;

  return new;
end;
$$;
drop trigger if exists notify_event_like_after_insert on public.event_likes;
create trigger notify_event_like_after_insert
after insert on public.event_likes
for each row execute function public.notify_event_like_insert();
drop trigger if exists notify_event_attendance_after_insert on public.event_attendees;
create trigger notify_event_attendance_after_insert
after insert on public.event_attendees
for each row execute function public.notify_event_attendance_insert();
drop trigger if exists notify_event_comment_after_insert on public.event_comments;
create trigger notify_event_comment_after_insert
after insert on public.event_comments
for each row execute function public.notify_event_comment_insert();
drop trigger if exists notify_album_photo_after_insert on public.album_photos;
create trigger notify_album_photo_after_insert
after insert on public.album_photos
for each row execute function public.notify_album_photo_insert();
drop trigger if exists notify_album_photo_like_after_insert on public.album_photo_likes;
create trigger notify_album_photo_like_after_insert
after insert on public.album_photo_likes
for each row execute function public.notify_album_photo_like_insert();
drop trigger if exists notify_album_photo_comment_after_insert on public.album_photo_comments;
create trigger notify_album_photo_comment_after_insert
after insert on public.album_photo_comments
for each row execute function public.notify_album_photo_comment_insert();
