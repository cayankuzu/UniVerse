# Push current contract

## Scope and truth boundary

Push hardening serves the existing notification inbox only. It does not add a notification type,
category, channel, permission, deep link, screen, setting, CTA, or HTTP route. The frozen product
surface remains [existing-feature-contract.md](existing-feature-contract.md).

Repository source establishes the following contract; it is not proof that Expo, Supabase, or a
physical device has completed a delivery.

```text
existing notification insert
  -> notification_push_dispatch_queue
  -> server /push/dispatch worker
  -> Expo ticket + receipt reconciliation
  -> existing notification response navigation
```

The inbox is still projection-first. Push is an optional delivery signal, never the source of truth:
a notification response first resolves the existing notification projection under the authenticated
viewer before it navigates to an existing profile, album, event, or Notifications destination.

## Existing types and destinations

The only supported types are `follow`, `follow_request`, `follow_accepted`, `like`, `comment`,
`event`, `join`, `join_request`, `join_accepted`, `join_rejected`, and `system`. Android has the
existing `default` channel and no notification action/category identifiers. Payload data is limited
to the opaque existing notification ID. Every remote title/body is generic. Actor names,
usernames, comment/detail text, email, media URLs, and event/photo/profile IDs are never serialized
for remote delivery. After authentication, the app resolves the ID through the viewer-scoped
notification projection and falls back to the existing Notifications destination when it is not
visible.

## Registration and identity

`POST /push/register` is the existing authenticated, rate-limited (10 registrations/user/minute)
route. It validates the Expo token, app environment, platform, optional EAS project ID, and the
paired opaque installation UUID/generation metadata. It has no direct table mutation from a caller:

- the Edge route uses its service-role client to invoke `register_push_device_token`;
- the forward migration `20260831163000_push_installation_account_switch_hardening.sql` keeps
  `installation_id` nullable for old clients, adds forced-RLS internal generation state, fixes both
  function search paths, revokes public execution, and grants only `service_role` execution;
- registration serializes the whole installation, rejects stale/equal-conflicting generations,
  and deactivates all older installation tokens before upserting the current token;
- logout uses the same ordering lock to write a newer tombstone and deactivate the installation,
  including when no token survived in local storage; and
- a partial unique index enforces at most one active row for a populated installation.

The mobile app stores the installation UUID and one serialized monotonic counter in SecureStore.
They are correlation/order values, not authentication credentials. Each register or tombstone first
reserves the next generation. The server-owned state makes network completion order irrelevant: an
older A register cannot overtake A's logout or B's later register. Pure token-only legacy rows remain
compatible; a legacy replay cannot reactivate a token after it becomes generation-tracked.

`POST /push/unregister` remains authenticated and idempotent from the client perspective. New
clients send installation/generation context to the service-role-only tombstone RPC; token-only old
clients retain the existing authenticated deactivation path.

## Recipient-bound delivery and rollout order

`20260831173000_push_delivery_privacy_leases.sql` adds a revision to each token and a short-lived,
recipient-bound delivery lease. Claim returns the current active token/project/platform only when
notification recipient, app environment, preference, block state, token revision, and current
installation owner all agree. Immediately before provider I/O, consume atomically repeats those
checks and returns the current token again. Register, tombstone, token reassignment, and installation
generation changes invalidate any provider-unconfirmed lease. Provider I/O cannot be part of that
transaction, so the generic payload rule is the final privacy boundary if ownership changes after
consume.

Deployment order is strict:

1. deploy the forward migration, which enables the lease RPCs and revokes `service_role` execution
   on legacy `claim_notification_push_deliveries`;
2. deploy this lease-aware, generic-payload Edge version; and
3. treat only a lease-aware generic-payload Edge version as a rollback baseline.

Rolling Edge back to a pre-lease version intentionally causes push claim failure/outage instead of
reopening private-content delivery. Do not re-grant the legacy claim RPC during rollback. Inbox
projections remain the source of truth while push is unavailable.

## Logout and failure behavior

Logout waits up to 3.5 seconds for unregister. Only a confirmed `success: true, applied: true`
clears the stored registration. `applied: false` is retained as unconfirmed cleanup.
Network, auth, timeout, malformed-success, storage-read, or storage-clear failures retain it,
complete logout, preserve retry state through the logout cleanup boundary, and emit recoverable
telemetry plus a redacted development warning. A later authenticated registration reuses the
installation identity and reconciles the server state atomically. Counter reservations, stored
registration writes, and removals share one serialized queue; writes also receive a local revision
UUID. A stale generation cannot persist locally, and a late successful unregister cannot clear a
registration written by a later login.

Permission loss and local-runtime push disablement use the same confirmed-cleanup rule. They do not
silently discard a registration after an unconfirmed request.

Every generic auth cleanup boundary (`SIGNED_OUT`, auth recovery failure, auth-storage version
reset, failed login cleanup, and password recovery cleanup) preserves the local registration proof
by default. Intentional logout suppresses its own Supabase `SIGNED_OUT` callback so the callback
cannot run a second cleanup with different semantics. The only non-tombstone path allowed to clear
that proof is a runtime-validated `{ success: true }` account-delete response, because the database
profile/token cascade is then confirmed. Delete errors, malformed success responses, and provider
session uncertainty keep the user signed in and retain the proof; a null `getUser` observation is
not accepted as deletion evidence.

## Evidence status

The repository has deferred register-to-logout and A-to-B ordering tests, missing-token tombstone and
owner-mismatch cleanup tests, plus a static migration/RLS/service-role contract and transactional SQL
validation pack. It has no attached remote migration result, Expo
receipt evidence, credential inspection, or physical Android/iOS delivery result. Use
[push-real-device-matrix.md](push-real-device-matrix.md) and
[MANUAL_STEPS.md](MANUAL_STEPS.md) before treating this as a release claim.

Related operating detail lives in:

- [push-provider-and-token-lifecycle.md](push-provider-and-token-lifecycle.md)
- [push-outbox-retry-receipt-dlq.md](push-outbox-retry-receipt-dlq.md)
- [push-incident-and-credential-rotation-runbook.md](push-incident-and-credential-rotation-runbook.md)
