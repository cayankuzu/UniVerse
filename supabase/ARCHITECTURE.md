# Supabase Architecture

## Goals

- Predictable relational model (no hidden KV coupling).
- Strict RLS-first security.
- Simple query paths for mobile app and edge functions.
- Private storage bucket with owner-folder isolation and signed URL delivery.
- Single-source-of-truth updates (profile edits must update existing rows, never create users).
- Deterministic compatibility sync for legacy KV reads.

## Migration Policy

- The only executable migration chain is `supabase/migrations`.
- The active chain starts with the canonical 2026-04 baseline set:
  - `20260422000100_extensions_enums_core.sql`
  - `20260422000200_core_tables.sql`
  - `20260422000300_auth_visibility.sql`
  - `20260422000400_storage_media.sql`
  - `20260422000500_social_relationships.sql`
  - `20260422000600_content_system.sql`
  - `20260422000700_notifications.sql`
  - `20260422000800_projection_infrastructure.sql`
  - `20260422000900_projection_surfaces.sql`
  - `20260422001000_mutation_idempotency.sql`
  - `20260422001100_push_pipeline.sql`
  - `20260422001200_security_telemetry.sql`
  - `20260422001300_performance_counters.sql`
  - `20260422001400_optional_cleanup.sql`
  - `20260422001500_harden_account_deletion.sql`
- All newer SQL files in `supabase/migrations` are incremental deltas on top of that baseline.
- Historical/experimental migration trees are not kept as parallel working directories anymore; Git history is the archive.
- Do not add sibling chains such as `migrations_v2` or `migrations_legacy_*`.

## Core Domains

- `profiles`: user identity + account metadata.
- `follows`, `blocks`: social graph.
- `club_memberships`: club join requests and accepted members.
- `events`, `event_attendees`, `event_likes`, `event_comments`: event lifecycle.
- `album_photos`, `album_photo_likes`, `album_photo_comments`: post-event media.
- `notifications`: user inbox.
- `reports`: moderation queue.
- `media_assets`: storage object registry for analytics/auditing.

## Update Invariants

- Profile mutations are `update` on `profiles.user_id` (or `upsert ... on conflict user_id` only for self-heal bootstrap).
- Username/email changes must migrate dependent indexes and compatibility keys:
  - `idx:username:*`, `idx:email:*`
  - `clubevents:*`, `clubmembers:*`, `student:clubs:*`
- Club profile metadata updates must fan out to club-owned event snapshots in compatibility KV to keep cards consistent.

## Security Model

- Every table has RLS enabled.
- Read checks rely on:
  - `public.can_view_profile(target_id)`
  - `public.can_view_event(event_id)`
- Blocking is symmetric at visibility level (`is_blocked_pair`) so blocked pairs cannot view each other.
- Write checks enforce ownership (`auth.uid()` must match row owner).
- Active media bucket is `make-e3557d40-media`.
- Direct `storage.objects` access is owner-folder only and uses the second path segment (`folder/{auth.uid()}/...`).
- Non-owner reads should resolve through short-lived signed URLs after `public.can_view_media_object(...)` authorization.

## RPC Contracts

- `public.toggle_event_like(target_event_id uuid)` -> `liked`, `likes_count`
- `public.toggle_event_attendance(target_event_id uuid)` -> `joined`, `attendees_count`
- `public.toggle_follow(target_user_id uuid)` -> `status` (`none | requested | following`)
- `public.toggle_club_membership(target_club_id uuid)` -> `status` (`none | requested`)
- `public.mark_notifications_read_all()` -> `updated_count`

## Compatibility Window

- Edge compat endpoints are rollback-only and are no longer primary for mobile reads.
- As of **7 March 2026**, mobile defaults `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`.
- As of **7 March 2026**, compat GET endpoints in `supabase/functions/server` return `410` unless `ENABLE_LEGACY_EDGE_READS=true`.
- As of **12 March 2026**, compat follow/block/notification handlers mount only through `supabase/functions/server/routeRegistry.ts` and stay off in production unless a non-production rollback env explicitly enables them.
- Planned permanent compat code removal date remains **15 April 2026** unless release hardening closes it earlier.

## Operational Notes

- Prefer SQL/RPC paths in mobile clients; compat KV endpoints are rollback-only.
- Add new schema changes only to `supabase/migrations`; do not introduce alternate migration folders.
- `ENABLE_COMPAT_ROUTES` should stay `false` in production-equivalent environments; normal production traffic must not depend on compat mutation mounts.
- For dynamic feeds/lists, avoid infinite-stale caches in client queries; use bounded stale windows and explicit invalidation after writes.
- After block/unblock, invalidate feed/profile/search/notification queries to guarantee immediate content removal.
- Client telemetry is batched through `public.log_client_telemetry_batch(jsonb)` and should be monitored alongside RPC latency.

## Active Folder Convention (Storage)

- `avatars/{user_id}/...`
- `profiles/{user_id}/...`
- `covers/{user_id}/...`
- `events/{user_id}/...`
- `albums/{user_id}/...`

## Recommended Next Step

- Remove rollback-only KV compat handlers entirely after load-test signoff and release hardening.
