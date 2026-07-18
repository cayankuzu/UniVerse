# Security Audit

## Status

- Audit refreshed on March 11, 2026.
- Goal of this pass: production hardening without changing projection-first mobile reads, rollback-only compat routing, or public API shapes.

## Closed In This Pass

- Acceptance and release baseline
  - Added a repo-owned Expo Doctor wrapper via `npm run guard:expo-doctor`.
  - `security:verify:internal` now fails on real Expo Doctor findings but explicitly allows only the known hybrid native/config warning for `scheme` and `userInterfaceStyle`.
  - Added `scheme` and `userInterfaceStyle` to `app.json` so iOS config stays explicit and release verification can go green.
- Secrets and environment handling
  - Expanded `.gitignore` to cover `.env.*` local files.
  - Mobile demo credentials now short-circuit in production runtime so `EXPO_PUBLIC_DEMO_*` values are treated as non-production fixtures only.
  - Hardening policy for historical leaks is now rotate-first, cleanup-second:
    - run `npm run security:secrets:history` in a prepared environment
    - rotate any live credential immediately
    - document the incident and plan history rewrite separately instead of force-pushing during a hardening pass
- Privacy-safe logging and telemetry
  - Shared redaction now masks tokens, auth headers, reset links, email-bearing payloads, signed URL secrets, `signature`, `sig`, `x-amz-signature`, `x-amz-credential`, and `x-amz-security-token`.
  - Edge logging redaction now mirrors mobile redaction rules so sensitive query params are scrubbed before export.
- Compat server typing and validation
  - Added `compatRouteValidation.ts` with bounded `zod` schemas for usernames, IDs, feed filters, event create bodies, album create bodies, album sync bodies, and comment payloads.
  - Removed `any` from the compat route files carrying the highest risk:
    - `routes/events.ts`
    - `routes/albums.ts`
    - `routes/profiles.ts`
    - `routes/follows.ts`
    - `routes/social.ts`
    - `routes/contentCleanup.ts`
    - `routes/albumRouteHelpers.ts`
    - `index.ts`
  - Added stronger shared types for profile, event, notification, follow, comment, album photo, and boolean-like KV records.
  - `index.ts` now uses typed notification persistence, typed profile hydration, typed KV prefix scans, and typed blocked-row filtering.
- Storage and signed URL safety
  - Signed URL and upload logs now scrub signature-bearing query parameters consistently.
  - Existing private-bucket model, 10-minute signed URL TTL, MIME/size enforcement, and random object naming remain intact.
- RLS and SQL verification
  - Expanded `supabase/validation/05_rls_storage_audit.sql` to require RLS coverage for:
    - `event_comment_likes`
    - `album_photo_comment_likes`
    - `client_telemetry_events`

## Validation Baseline

- Local commands required for this pass:
  - `npm run check`
  - `npm run security:verify:internal`
- Additional prepared-environment commands:
  - `npm run security:sast`
  - `npm run security:secrets`
  - `npm run security:secrets:history`
  - `npm run release:verify`
  - `supabase/validation/01-06`
- Current local result on March 11, 2026:
  - `npm run check` passes.
  - `npm run security:verify:internal` passes.
  - `gitleaks` is still required locally before `security:secrets` and `security:secrets:history` can be executed.

## Remaining Risks

- Auth and discovery compat files still contain legacy `any` usage internally. High-risk mounted read/write paths and shared entrypoint helpers are typed, but these two modules still need a follow-up pass.
- Historical secret scanning still depends on a prepared environment with `gitleaks` installed and credential rotation authority available.
- SQL validation still needs to be executed against the target Supabase environment after the new required-table assertions are in place.
- Mobile MASVS controls remain docs-only in this pass:
  - secure storage review and logout cleanup verification
  - root/jailbreak/emulator/debuggable-build decision
  - SSL pinning decision and certificate rotation plan

## Guardrails That Must Stay True

- `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true` remains the mobile default.
- Projection-first mobile reads remain the source of truth.
- Rollback-only compat GET handlers remain non-primary.
- Production auth recovery routes stay env-gated.
- Password fallback remains unmounted from the server entrypoint.
