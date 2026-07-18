# UniVerse Mobile Security Blueprint

This document defines the repo-enforceable mobile security baseline for the March 12, 2026 MVP hardening pass.

## Scope

- Applies to mobile auth storage, local cache cleanup, rollback-only compat mutation routes, SQL audit coverage, guards, and tests.
- Keeps projection-first mobile reads intact. Security work must not reintroduce legacy edge reads as a primary path.
- Treats device integrity and full MASVS regression as roadmap-only items tracked in
  [mobile-security-roadmap.md](mobile-security-roadmap.md).
- Treats certificate pinning as an explicit risk-acceptance decision for the current
  release baseline in [ADR-0001](adr/0001-network-trust-certificate-pinning.md).

## Security Objectives

- Auth-sensitive values stay in SecureStore or other platform-backed secure storage.
- Logout, delete-account, auth storage version reset, and auth recovery failures purge sensitive client state from memory and disk.
- Password policy is consistent for register and reset flows.
- Rollback-only compat mutation routes are input-validated, rate-limited, and never promoted back to primary reads.
- Critical SQL tables keep RLS enabled and the top-level mutable resources expose explicit `updated_by` audit fields.

## Implemented Repo Controls

### Mobile auth and local storage

- `supabaseAuthStorage` remains SecureStore-backed with AsyncStorage fallback only when SecureStore is unavailable.
- `clearSensitiveClientState(...)` is the single purge entry point for:
  - SecureStore auth artifacts
  - Supabase auth AsyncStorage remnants
  - persisted TanStack query cache
  - follow shadow cache
  - follow pending cache
  - upload queue
  - local event and album shadow caches
  - in-memory query, sync, and optimistic state stores
- `hardSignOut(...)` now routes through the centralized purge helper.
- Auth callback and reset-password boundaries purge local sensitive state when auth recovery fails.
- Onboarding and other non-auth UI preferences are intentionally preserved.

### Password policy

- Shared policy:
  - minimum length: 10
  - maximum length: 72
  - requires lowercase, uppercase, and digit
- Applied to:
  - student registration
  - club registration
  - reset password
- Login remains intentionally looser so existing accounts are not locked out by a stricter client-side validator.

### Compat server route hardening

- Central compat mutation rate-limit helper is required for rollback-only write routes.
- Current enforced limits:
  - follow, block, request accept/reject: 30 per minute per user, 60 per minute per IP
  - event and album like/attend toggles: 60 per minute per user, 120 per minute per IP
  - event and album comment create/delete: 20 per minute per user, 40 per minute per IP
  - event create/delete and album create/delete/sync: 6 per 10 minutes per user, 12 per 10 minutes per IP
  - notification read and read-all: 120 per minute per user, 240 per minute per IP
- State-changing compat routes continue to use schema validation from the compat validation layer.
- Authorization remains derived from `getUser(c)` rather than client-supplied identifiers.

### SQL, RLS, and audit coverage

- Supabase changes remain migration-first.
- `profiles.updated_by` and `events.updated_by` are part of the security baseline.
- `update_profile_privacy(...)` now records `updated_by`.
- SQL validation pack checks:
  - critical tables still have RLS and policies
  - media authorization function is present
  - storage bucket privacy and policy constraints remain intact
  - `profiles.updated_by` and `events.updated_by` exist

### Guard and test enforcement

- `guard:security-mobile` is part of `npm run check`.
- The guard enforces:
  - SecureStore-backed auth storage remains in place
  - centralized purge is used by `hardSignOut`
  - logout and delete-account use the purge path
  - auth callback and reset-password boundaries purge on recovery failure
  - deep-link auth handling still scrubs navigation state
  - rollback-only compat mutation routes use the centralized rate-limit helper
- Jest coverage includes:
  - auth storage secure-store behavior
  - password policy
  - redaction helpers
  - sensitive client state purge

## Non-Goals for This Pass

- Native certificate pinning, per ADR-0001
- emulator, root, or jailbreak detection
- full offline mutation outbox hardening
- manual MASVS evidence collection

These remain tracked in the roadmap and are not required for this MVP repo-first pass.
