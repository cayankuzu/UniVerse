# Existing Feature Contract

This document freezes the end-user product surface found at commit
`1caace7fa52dd56e8fd968983b1b1a1ea36da7cd`. Repository source is authoritative. The
machine-readable companion is `quality/feature-surface.snapshot.json`; this document explains the
user jobs and the runtime status that cannot be expressed by names alone.

The contract does not certify a release or a real-device run. It records what already exists so
security, reliability, accessibility, performance, Cloudflare, and OTA work can improve that same
surface without expanding it.

## Navigation, screens, and user jobs

| Route             | Screen entrypoint           | Access             | Existing user job                                                                        |
| ----------------- | --------------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `Welcome`         | `WelcomeScreen`             | Guest              | Enter the existing sign-in or registration flows.                                        |
| `Login`           | `LoginScreen`               | Guest              | Sign in with the existing email/password method.                                         |
| `Register`        | `RegisterScreen`            | Guest              | Choose the existing student or club account path.                                        |
| `StudentRegister` | `StudentRegisterScreen`     | Guest              | Complete the student registration wizard.                                                |
| `ClubRegister`    | `ClubRegisterScreen`        | Guest              | Complete the club registration wizard.                                                   |
| `VerifyEmail`     | `VerifyEmailScreen`         | Guest              | Check or resend email verification.                                                      |
| `ForgotPassword`  | `ForgotPasswordScreen`      | Guest              | Request the existing password-reset email.                                               |
| `AuthCallback`    | `AuthCallbackScreen`        | Guest/root         | Complete the Supabase auth callback.                                                     |
| `ResetPassword`   | `ResetPasswordScreen`       | Guest/root         | Set a new password from the reset link.                                                  |
| `Home`            | `HomeScreen`                | Authenticated      | Read and filter the existing event/album feed.                                           |
| `Search`          | `SearchScreen`              | Authenticated      | Find existing albums, events, clubs, and students.                                       |
| `Profile`         | `ProfileScreen`             | Authenticated      | View the signed-in account's profile, events, albums, and relationship counts.           |
| `CreateEvent`     | `CreateEventScreen`         | Authenticated club | Create an event using the existing form and media flow.                                  |
| `Settings`        | `SettingsScreen`            | Authenticated      | Open existing account, permission, logout, and deletion controls.                        |
| `Permissions`     | `PermissionsSettingsScreen` | Authenticated      | Inspect/request the four existing device permissions.                                    |
| `PrivacySettings` | `PrivacySettingsScreen`     | Authenticated      | Control the existing account-privacy and email-visibility preferences.                   |
| `EditProfile`     | `EditProfileScreen`         | Authenticated      | Edit the existing profile fields and media.                                              |
| `UserList`        | `UserListScreen`            | Authenticated      | Browse/search an existing followers or following list.                                   |
| `ViewProfile`     | `ViewProfileScreen`         | Authenticated      | View another profile and use the existing follow, block, report, and content actions.    |
| `AlbumView`       | `AlbumViewScreen`           | Authenticated      | View an event album and use its existing upload/content interactions.                    |
| `EventDetail`     | `EventDetailScreen`         | Authenticated      | View an event and use its existing attendance, like, comment, report, and owner actions. |
| `Notifications`   | `NotificationsScreen`       | Authenticated      | Read/filter notifications and mark them read.                                            |
| `ChangePassword`  | `ChangePasswordScreen`      | Authenticated      | Verify the current password and request the existing reset email.                        |
| `BlockedUsers`    | `BlockedUsersScreen`        | Authenticated      | Review blocked accounts, open a profile, and unblock.                                    |

Navigator containers are `AuthNavigator` and `MainTabsNavigator`. The navigator tab routes are
`HomeTab`, `SearchTab`, and `ProfileTab`. The visible bottom-bar keys are `home`, `search`, `create`,
and `profile`; `create` is an existing club-only action that opens `CreateEvent`, not another tab
navigator.

The existing overlay/modal jobs are limited to onboarding permissions, legal consent, media source
and library selection, camera/video capture, media preview, comment/reaction user lists, location
details, overflow/owner actions, reports, destructive confirmation, and account deletion. The
snapshot fingerprints every production modal-wrapper mount (59 mounts) so adding or removing an
overlay fails the feature-freeze guard.

## Deep links

| Route           | Path             | Notes                        |
| --------------- | ---------------- | ---------------------------- |
| `AuthCallback`  | `auth/callback`  | Supabase auth callback only. |
| `ResetPassword` | `reset-password` | Password recovery only.      |

The configured custom scheme is `ogrencisosyalagi`. Android also declares an HTTPS query for
outbound link resolution, but no additional product route is configured as an App Link in the root
linking map.

## Settings groups and visible controls

| Group key     | Item/CTA keys                                                 | Existing behavior                                                                  |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `account`     | `edit-profile`, `privacy`, `change-password`, `blocked-users` | `privacy` is hidden for club accounts; the other existing account controls remain. |
| `permissions` | `permissions`                                                 | Opens the existing permission status/request surface.                              |
| `other`       | `logout`, `delete-account`                                    | Ends the session or starts the existing destructive account-deletion confirmation. |

The only action kinds are `navigate`, `logout`, and `delete-account`. The privacy surface contains
two switches: account privacy and email visibility. The permission surface contains only
`notifications`, `photos`, `camera`, and `microphone`.

## Notifications

The canonical mobile and PostgreSQL notification types are identical:

| Type                                                     | Existing domain                               |
| -------------------------------------------------------- | --------------------------------------------- |
| `follow`, `follow_request`, `follow_accepted`            | Social relationship activity.                 |
| `like`, `comment`                                        | Existing event/album content interactions.    |
| `event`                                                  | Existing event publication/activity.          |
| `join`, `join_request`, `join_accepted`, `join_rejected` | Existing attendance/club membership activity. |
| `system`                                                 | Existing generic system delivery type.        |

The inbox filter categories are `all`, `social`, `like`, `comment`, and `club`. Android uses the
single channel ID `default`; no Expo notification category/action identifiers are registered.

### Push delivery hardening boundary

Push remains an optional signal for this same inbox, never a new navigation or read model. The
existing authenticated register/unregister routes and service-role delivery worker are retained.
`push_device_tokens.installation_id` is nullable internal metadata used only to prevent a new
account registration on the same physical installation from leaving another account's active token
behind. It does not expose a mobile table/RPC, add a notification category/type, or change the
existing destinations. The detailed source contract and evidence boundary are in
[push-current-contract.md](push-current-contract.md).

## Native permissions and capabilities

| Surface                                              | Existing declaration                                                                                                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime permission keys                              | `camera`, `microphone`, `notifications`, `photos`                                                                                                                                                                |
| Android permissions                                  | `CAMERA`, `INTERNET`, `READ_EXTERNAL_STORAGE` (through API 32), `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `RECORD_AUDIO`, `VIBRATE`, `WRITE_EXTERNAL_STORAGE` (through API 32) |
| Optional Android features                            | Camera, any camera, autofocus, microphone; all are `required=false`.                                                                                                                                             |
| Android capability                                   | Picture-in-picture is enabled for the existing video surface.                                                                                                                                                    |
| iOS usage-description keys in source config          | `NSMicrophoneUsageDescription`, `NSPhotoLibraryAddUsageDescription`; image/media plugins also carry the existing camera/photo/microphone prompts.                                                                |
| iOS entitlements in source config                    | None.                                                                                                                                                                                                            |
| Expo native plugins in effective iOS prebuild config | `expo-asset`, `expo-image-picker`, `expo-media-library`, `expo-notifications`, `expo-video`, `expo-secure-store`, `expo-sqlite`                                                                                  |

There is no checked-in `ios/` tree. The iOS values above describe `config/ios-prebuild.json`, not an
inspection of a published IPA. Location, contacts, calendar, Bluetooth, health, biometric, and new
associated-domain capabilities are not part of this product contract.

## API and data contracts

Supabase Auth, PostgreSQL/RLS, projection SQL/RPC, Realtime, and private Storage remain the source of
truth. Mobile reads stay projection-first. The server compat GET routes are rollback-only and must
not become the primary mobile read path.

### Edge Function and HTTP routes

The only Edge Function domain is `server`, mounted under `/server`; route literals below are relative
to that Hono base path. These 35 routes are mounted by the normal primary registry:

```text
GET    /make-server-e3557d40/health
GET    /make-server-e3557d40/auth/check-email
GET    /make-server-e3557d40/auth/check-username/:username
GET    /make-server-e3557d40/auth/me
POST   /make-server-e3557d40/auth/register-direct
POST   /make-server-e3557d40/auth/register
PUT    /make-server-e3557d40/auth/profile
PUT    /make-server-e3557d40/auth/privacy
POST   /make-server-e3557d40/auth/delete-account
POST   /make-server-e3557d40/push/register
POST   /make-server-e3557d40/push/unregister
POST   /make-server-e3557d40/push/dispatch
POST   /make-server-e3557d40/events
POST   /make-server-e3557d40/events/:id/like
POST   /make-server-e3557d40/events/:id/attend
DELETE /make-server-e3557d40/events/:id
GET    /make-server-e3557d40/events/:id/comments
POST   /make-server-e3557d40/events/:id/comments
DELETE /make-server-e3557d40/events/:id/comments/:commentId
POST   /make-server-e3557d40/albums
POST   /make-server-e3557d40/albums/sync
POST   /make-server-e3557d40/albums/:photoId/like
DELETE /make-server-e3557d40/albums/:photoId
GET    /make-server-e3557d40/albums/:photoId/comments
POST   /make-server-e3557d40/albums/:photoId/comments
DELETE /make-server-e3557d40/albums/:photoId/comments/:commentId
POST   /make-server-e3557d40/reports
POST   /make-server-e3557d40/storage/upload-ticket
POST   /make-server-e3557d40/storage/upload
POST   /make-server-e3557d40/storage/signed-url
POST   /make-server-e3557d40/storage/upload-confirm
POST   /make-server-e3557d40/storage/upload-session/create
POST   /make-server-e3557d40/storage/upload-session/finalize
POST   /make-server-e3557d40/storage/upload-session/cancel
POST   /make-server-e3557d40/storage/upload-session/sweep
```

Four route literals exist behind narrower conditions:

- `POST auth/materialize-profile` and `POST auth/repair-data` require the non-production recovery
  gate.
- `POST auth/test/confirm-email` requires the non-production test-verification bypass gate.
- `POST auth/change-password` is a disabled fallback; the primary registry passes
  `mountPasswordFallback=false`, including production.

The following 12 routes are mounted only when the rollback compat gate is enabled. Production keeps
that gate disabled:

```text
GET    /make-server-e3557d40/follows/status/:username
POST   /make-server-e3557d40/follows/:username
GET    /make-server-e3557d40/follows/requests
POST   /make-server-e3557d40/follows/requests/:username/accept
POST   /make-server-e3557d40/follows/requests/:username/reject
GET    /make-server-e3557d40/blocks
GET    /make-server-e3557d40/blocks/check/:username
POST   /make-server-e3557d40/blocks/:username
DELETE /make-server-e3557d40/blocks/:username
GET    /make-server-e3557d40/notifications
PUT    /make-server-e3557d40/notifications/read-all
PUT    /make-server-e3557d40/notifications/:id/read
```

### Mobile SQL/RPC and direct relations

The 19 mobile RPC names are:

```text
app_warmup_projection
can_view_profile
create_album_photo_with_patch
create_event_with_patch
delete_own_account
get_event_album_card_counts
get_event_capabilities
get_follow_state
get_profile_capabilities
get_profile_summary
list_profile_visible_albums
list_visible_albums
log_client_telemetry_batch
relationship_snapshot_projection
resolve_profile_id
toggle_album_photo_like
update_profile_patch
update_profile_privacy_with_patch
viewer_blocked_snapshot
```

The mobile source also names these direct Supabase relations for scoped reads/mutations:
`album_photo_comments`, `album_photo_likes`, `album_photos`, `blocks`, `event_attendees`,
`event_comments`, `event_likes`, `event_metrics`, `events`, `follows`, `notifications`, and
`profiles`. This list is an inventory, not permission to restore broad screen-owned reads; SQL/RPC
projections remain primary for read-heavy flows.

### Product tables and Storage

Product-domain tables are:

```text
album_photo_comment_likes  album_photo_comments  album_photo_likes  album_photos
blocks                     club_memberships      event_attendees    event_comment_likes
event_comments             event_likes           events             follows
media_assets               notifications        profiles           reports
```

Existing infrastructure tables cover projection counters/caches, mutation receipts, telemetry,
security audit/detection/rate limits, push tokens/dispatch/delivery, upload sessions/cleanup, and the
rollback KV store. Their exact names are retained in the machine snapshot so a newly created table
cannot be disguised by omission.

The only Storage bucket is private `make-e3557d40-media`.

## Explicitly out of scope

No new screen, route, top-level modal, tab, onboarding step, CTA, settings group, filter, catalog,
notification type/category, native permission/entitlement, product table, public product API domain,
content type, or user job may be added under this hardening program. In particular, calendar,
reminders, QR, waitlist, saved search, verified badges, recommendation explanations, premium,
payments, ads, dark theme, portals, dashboards, and admin/moderator/organizer panels remain out of
scope.

Internal security/ops tables, outbox/delivery/audit/telemetry records, and explicitly internal
`/internal/*` or `/ops/*` routes are the only narrow machine allowlist. They must remain invisible to
end users and may only harden an existing flow.
