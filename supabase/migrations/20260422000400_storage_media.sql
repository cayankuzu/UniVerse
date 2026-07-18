-- Canonical baseline migration.
-- Sources:
--   - 20260311090000_storage_authorization_hardening.sql
--   - 20260314013000_storage_visible_signed_urls.sql

insert into storage.buckets (id, name, public)
values ('make-e3557d40-media', 'make-e3557d40-media', false)
on conflict (id) do update
set public = excluded.public;
alter table public.media_assets enable row level security;
create or replace function public.can_view_media_object(
  target_object_path text,
  viewer_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_path text := btrim(coalesce(target_object_path, ''));
  resolved_viewer_id uuid := viewer_id;
  asset_owner_id uuid;
  asset_visibility public.media_visibility;
  target_profile_id uuid;
  target_event_id uuid;
  target_event_club_id uuid;
  target_event_visibility public.event_visibility;
  target_club_is_private boolean := false;
  target_photo_id uuid;
  target_uploader_id uuid;
  target_uploader_is_private boolean := false;
  album_show_on_profile boolean := false;
  album_show_on_user_profile boolean := false;
  album_show_on_club_profile boolean := false;
  viewer_follows_club boolean := false;
  viewer_follows_uploader boolean := false;
  viewer_is_event_attendee boolean := false;
  viewer_owns_photo boolean := false;
  can_view_uploader_profile boolean := false;
  can_view_club_profile boolean := false;
  event_discoverable boolean := false;
  event_album_openable boolean := false;
begin
  if normalized_path = '' then
    return false;
  end if;

  select ma.owner_id, ma.visibility
    into asset_owner_id, asset_visibility
  from public.media_assets ma
  where ma.bucket_id = 'make-e3557d40-media'
    and ma.object_path = normalized_path
  limit 1;

  if asset_owner_id is not null and resolved_viewer_id is not null and asset_owner_id = resolved_viewer_id then
    return true;
  end if;

  if asset_visibility = 'public'::public.media_visibility then
    return true;
  end if;

  select p.user_id
    into target_profile_id
  from public.profiles p
  where p.deleted_at is null
    and (p.profile_image_path = normalized_path or p.cover_image_path = normalized_path)
  limit 1;

  if target_profile_id is not null then
    if resolved_viewer_id is not null and public.is_blocked_pair(resolved_viewer_id, target_profile_id) then
      return false;
    end if;
    return true;
  end if;

  select e.id, e.club_id, e.visibility, club.is_private
    into target_event_id, target_event_club_id, target_event_visibility, target_club_is_private
  from public.events e
  join public.profiles club on club.user_id = e.club_id
  where e.deleted_at is null
    and club.deleted_at is null
    and e.cover_image_path = normalized_path
  limit 1;

  if target_event_id is not null then
    if resolved_viewer_id is not null and public.is_blocked_pair(resolved_viewer_id, target_event_club_id) then
      return false;
    end if;

    if resolved_viewer_id is not null and resolved_viewer_id = target_event_club_id then
      return true;
    end if;

    if resolved_viewer_id is not null then
      viewer_follows_club := public.is_accepted_follower(resolved_viewer_id, target_event_club_id);
      select exists (
        select 1 from public.event_attendees ea where ea.event_id = target_event_id and ea.user_id = resolved_viewer_id
      ) into viewer_is_event_attendee;
    end if;

    if coalesce(target_club_is_private, false) then
      return coalesce(viewer_follows_club or viewer_is_event_attendee, false);
    end if;

    return true;
  end if;

  select ap.id, ap.user_id, ap.event_id, e.club_id, e.visibility, uploader.is_private, club.is_private,
         coalesce(ap.show_on_profile, false),
         coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
         coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
    into target_photo_id, target_uploader_id, target_event_id, target_event_club_id,
         target_event_visibility, target_uploader_is_private, target_club_is_private,
         album_show_on_profile, album_show_on_user_profile, album_show_on_club_profile
  from public.album_photos ap
  join public.events e on e.id = ap.event_id
  join public.profiles uploader on uploader.user_id = ap.user_id
  join public.profiles club on club.user_id = e.club_id
  where ap.deleted_at is null and e.deleted_at is null and uploader.deleted_at is null and club.deleted_at is null
    and (ap.storage_path = normalized_path or normalized_path = any(coalesce(ap.media_paths, array[ap.storage_path])))
  limit 1;

  if target_photo_id is null then
    return false;
  end if;

  if resolved_viewer_id is not null and (
    public.is_blocked_pair(resolved_viewer_id, target_uploader_id)
    or public.is_blocked_pair(resolved_viewer_id, target_event_club_id)
  ) then
    return false;
  end if;

  viewer_owns_photo := resolved_viewer_id is not null and resolved_viewer_id = target_uploader_id;
  if viewer_owns_photo or (resolved_viewer_id is not null and resolved_viewer_id = target_event_club_id) then
    return true;
  end if;

  if resolved_viewer_id is not null then
    viewer_follows_club := public.is_accepted_follower(resolved_viewer_id, target_event_club_id);
    viewer_follows_uploader := resolved_viewer_id <> target_uploader_id and public.is_accepted_follower(resolved_viewer_id, target_uploader_id);
    select exists (
      select 1 from public.event_attendees ea where ea.event_id = target_event_id and ea.user_id = resolved_viewer_id
    ) into viewer_is_event_attendee;
  end if;

  if coalesce(target_club_is_private, false) then
    event_discoverable := coalesce(viewer_follows_club or viewer_is_event_attendee, false);
  else
    event_discoverable := true;
  end if;

  event_album_openable := event_discoverable and (
    target_event_visibility <> 'members_only'::public.event_visibility
    or viewer_follows_club
    or viewer_is_event_attendee
  );

  can_view_uploader_profile := album_show_on_user_profile and (
    not coalesce(target_uploader_is_private, false)
    or viewer_owns_photo
    or viewer_follows_uploader
  );

  can_view_club_profile := album_show_on_club_profile and (
    not coalesce(target_club_is_private, false)
    or viewer_follows_club
  );

  if event_discoverable and (
    album_show_on_club_profile
    or (album_show_on_user_profile and (not coalesce(target_uploader_is_private, false) or viewer_follows_uploader))
  ) then
    return true;
  end if;

  if event_discoverable and album_show_on_profile and not coalesce(target_uploader_is_private, false) then
    return true;
  end if;

  if event_album_openable and (
    album_show_on_club_profile or (album_show_on_user_profile and not coalesce(target_uploader_is_private, false))
  ) then
    return true;
  end if;

  if event_discoverable and (can_view_uploader_profile or can_view_club_profile) then
    return true;
  end if;

  return false;
end;
$$;
drop policy if exists "media_assets_select_visible_or_owner" on public.media_assets;
create policy "media_assets_select_visible_or_owner"
on public.media_assets
for select
using (public.can_view_media_object(object_path, (select auth.uid())));
drop policy if exists "media_assets_insert_owner" on public.media_assets;
create policy "media_assets_insert_owner"
on public.media_assets
for insert
with check ((select auth.uid()) = owner_id);
drop policy if exists "media_assets_update_owner" on public.media_assets;
create policy "media_assets_update_owner"
on public.media_assets
for update
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
drop policy if exists "media_assets_delete_owner" on public.media_assets;
create policy "media_assets_delete_owner"
on public.media_assets
for delete
using ((select auth.uid()) = owner_id);
drop policy if exists "media_read_authenticated" on storage.objects;
drop policy if exists "media_bucket_select_owner_only" on storage.objects;
drop policy if exists "media_bucket_select_visible_or_owner" on storage.objects;
drop policy if exists "media_bucket_insert_own_folder" on storage.objects;
drop policy if exists "media_bucket_update_own_folder" on storage.objects;
drop policy if exists "media_bucket_delete_own_folder" on storage.objects;
create policy "media_bucket_select_visible_or_owner"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'make-e3557d40-media'
  and (storage.foldername(name))[1] in ('albums', 'avatars', 'covers', 'events', 'profiles')
  and public.can_view_media_object(name, auth.uid())
);
create policy "media_bucket_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'make-e3557d40-media'
  and (storage.foldername(name))[1] in ('albums', 'avatars', 'covers', 'events', 'profiles')
  and auth.uid()::text = (storage.foldername(name))[2]
);
create policy "media_bucket_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'make-e3557d40-media'
  and (storage.foldername(name))[1] in ('albums', 'avatars', 'covers', 'events', 'profiles')
  and auth.uid()::text = (storage.foldername(name))[2]
)
with check (
  bucket_id = 'make-e3557d40-media'
  and (storage.foldername(name))[1] in ('albums', 'avatars', 'covers', 'events', 'profiles')
  and auth.uid()::text = (storage.foldername(name))[2]
);
create policy "media_bucket_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'make-e3557d40-media'
  and (storage.foldername(name))[1] in ('albums', 'avatars', 'covers', 'events', 'profiles')
  and auth.uid()::text = (storage.foldername(name))[2]
);
revoke all on function public.can_view_media_object(text, uuid) from public;
grant execute on function public.can_view_media_object(text, uuid) to authenticated;
grant execute on function public.can_view_media_object(text, uuid) to service_role;
