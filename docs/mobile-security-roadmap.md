# Mobile Security Roadmap

This file tracks the mobile-specific MASVS follow-up work that remains intentionally docs-only after the March 12, 2026 MVP repo-first hardening pass.

## Phase 1: Local Storage Review

- Verify every auth-sensitive value stays inside SecureStore or platform keychain-backed storage.
- Confirm logout removes cached session artifacts and no sensitive data remains on disk snapshots.
- Inspect offline caches for accidental PII retention.
- Manual regression required:
  - login, background, restore, logout, and relaunch on Android
  - confirm no access or refresh token appears in logs, URLs, or persistent plain-text storage

## Phase 2: Device Integrity Decisions

- Decide whether root, jailbreak, emulator, or debuggable-build detection is required for the target market.
- Document detection thresholds, bypass expectations, and UX fallback behavior.
- Define where integrity failures block actions versus only emit telemetry.
- Current decision status:
  - no runtime detection was added in this pass
  - product/security owners still need an explicit allow/deny policy before release hardening can be considered complete

## Phase 3: Network Trust

- Evaluate whether SSL pinning is justified for the threat model.
- If adopted, define certificate rotation, backup pin strategy, and failure handling.
- Validate operational impact on preview, staging, and emergency certificate rollover.
- Current decision status:
  - certificate pinning was not added in this pass
  - ADR-0001 records the current risk acceptance
  - final release evidence must attach either ADR-0001 signoff or native pinning rotation evidence

## Phase 4: Manual MASVS Regression

- Storage safety review on Android builds.
- Auth abuse scenarios:
  - reset-link reuse
  - token reuse after logout
  - session theft replay attempts
  - brute-force login attempts against provider-managed auth endpoints
- Privacy checks:
  - blocked users cannot resolve protected media
  - private profile and album visibility stays consistent across screens and signed URLs
  - deep-link auth tokens are removed from navigation state after processing
  - signed URL denial for unauthorized viewers and success for authorized owners/viewers
