-- Canonical baseline migration.
-- Sources:
--   - 20260304090000_extensions_and_enums.sql
--   - 20260306103000_notifications_enum_and_enqueue_dedupe.sql
--   - 20260326110000_server_rate_limits_and_reports_hardening.sql

create extension if not exists pgcrypto;
create extension if not exists citext;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type public.account_type as enum ('student', 'club');
  end if;

  if not exists (select 1 from pg_type where typname = 'follow_status') then
    create type public.follow_status as enum ('pending', 'accepted');
  end if;

  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum ('pending', 'accepted', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'event_visibility') then
    create type public.event_visibility as enum ('public', 'members_only');
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'follow',
      'follow_request',
      'follow_accepted',
      'like',
      'comment',
      'event',
      'join',
      'join_request',
      'join_accepted',
      'join_rejected',
      'system'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_target_type') then
    create type public.report_target_type as enum (
      'event',
      'user',
      'album',
      'event_comment',
      'album_comment'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open', 'reviewing', 'resolved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'media_visibility') then
    create type public.media_visibility as enum ('public', 'private');
  end if;
end
$$;
