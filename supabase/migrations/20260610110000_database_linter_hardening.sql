-- Safe hardening for Supabase advisor findings that do not require changing
-- the mobile app RPC contract.
-- NOTE: leaked password protection is an Auth dashboard setting and cannot be
-- enforced from a SQL migration.

alter function public.bump_projection_row()
  set search_path = '';
alter function public.touch_profile_projection_row(uuid)
  set search_path = '';
alter function public.touch_event_projection_row(uuid)
  set search_path = '';
alter function public.touch_album_projection_row(uuid)
  set search_path = '';
alter function public.touch_event_from_album_projection_row(uuid)
  set search_path = '';
alter function public.sync_touch_event_projection()
  set search_path = '';
alter function public.sync_touch_album_projection()
  set search_path = '';
alter function public.sync_touch_profile_projection()
  set search_path = '';
alter function public.display_projection_time(timestamptz)
  set search_path = '';
alter function public.build_projection_cursor(timestamptz, text)
  set search_path = '';
alter function public.set_updated_at()
  set search_path = '';
alter function public.ensure_event_owner_is_club()
  set search_path = '';
alter function public.is_accepted_follower(uuid, uuid)
  set search_path = '';
alter function public.is_blocked_pair(uuid, uuid)
  set search_path = '';
alter function public.normalize_event_cover_image_paths(text, text[])
  set search_path = '';
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
do $move_citext$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'citext'
      and n.nspname <> 'extensions'
  ) then
    execute 'alter extension citext set schema extensions';
  end if;
end;
$move_citext$;
-- `pg_net` does not support `ALTER EXTENSION ... SET SCHEMA`.
-- A follow-up migration reinstalls it into the `net` schema instead of using
-- `ALTER EXTENSION ... SET SCHEMA`.

revoke execute on all functions in schema public from public;
alter default privileges in schema public
  revoke execute on functions from public;
do $grant_legacy_rpc$
begin
  if to_regprocedure('public.get_event_album_card_counts(uuid[])') is not null then
    execute $sql$
      grant execute on function public.get_event_album_card_counts(uuid[]) to authenticated
    $sql$;
  end if;

  if to_regprocedure('public.update_profile_privacy_with_patch(boolean)') is not null then
    execute $sql$
      grant execute on function public.update_profile_privacy_with_patch(boolean) to authenticated
    $sql$;
  end if;
end;
$grant_legacy_rpc$;
