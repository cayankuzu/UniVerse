# AAA-MVP baseline

Updated: 2026-08-30
Baseline commit: `227329989bd937faff48c54291aeefc8b3942515`
Working branch: `chore/aaa-mvp-feature-freeze-cloudflare-ota`

## Evidence boundary

This is the pre-hardening repository baseline, not a production certification. The baseline commit
was the clean `main`/`origin/main` tip when the work began. The implementation tree now contains
uncommitted hardening changes, so any result from that tree must be rerun after commit and retained
under one immutable candidate SHA before it can be release evidence.

The only checked-in release-evidence bundle predates this candidate: it is for version `1.0.109` at
commit `28e4bcb8ec53df7eb13b354bf718b12d358c2acd`. Root EAS logs refer to versions `1.0.104` and
`1.0.105`. They establish neither the baseline `1.0.133` artifact state nor the candidate
`1.0.134` artifact, runtime, device, signing, OTA, or rollout status. Files under `artifacts/` are
likewise historical unless their manifest proves the same candidate SHA.

## Repository identity and product surface

| Fact                   | Baseline                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Expo / React Native    | Expo SDK `55`; React Native `0.83.10`                                                    |
| App / runtime version  | `1.0.133` / `1.0.133`, sourced from `config/app-release.json`                            |
| Android / iOS identity | `com.ogrencisosyalagi.app`; Android version code `133`; iOS build `133`                  |
| EAS project            | owner `cayanns-team`, slug `universe`, project ID `c7565eaa-d013-430f-9576-217c4beefa3f` |
| Native source          | committed `android/`; no committed `ios/` tree                                           |
| User-facing navigation | 24 leaf routes/screens, 3 navigator tabs, 4 visible bottom-bar keys                      |
| Other frozen surfaces  | 2 deep-link mappings, 59 modal-wrapper mounts, 11 notification types, 3 settings groups  |
| Data/API surface       | 19 mobile RPC names, 16 product-domain tables, one private Storage bucket                |
| Mobile code guard      | 1,229 `.ts`/`.tsx` files under `src/mobile`; zero files over 500 lines at inventory time |

The authoritative itemized surface is [existing-feature-contract.md](existing-feature-contract.md),
with the machine snapshot in `quality/feature-surface.snapshot.json`. The final surface comparison is
in [no-new-feature-audit.md](no-new-feature-audit.md). The baseline includes only the existing auth,
profiles, feed/search, social graph, events/attendance, albums/media/comments, notifications,
settings/privacy/report/block, and offline queue behaviors. It authorizes no new screen, tab, route,
CTA, notification type, product table, admin panel, or native capability.

## Architecture baseline

- Supabase Auth, PostgreSQL/RLS, SQL/RPC projections, Realtime, and private Storage are the source of
  truth.
- Read-heavy mobile flows are projection-first. Normal development keeps
  `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`; server compat GET routes remain rollback-only.
- Production auth recovery/test/password fallback routes are not mounted.
- The mobile roots are `app-shell`, `data`, `features`, `platform`, and `shared`, with architecture
  and maximum-line guards already present.
- Client HTTP already has bounded concurrency, timeout/caller abort composition, single body parse,
  auth-refresh recovery, typed failures, scoped GET dedupe/cache, and mutation-specific queues.
- Native auth/session and persistent mutation/upload queue payloads use SecureStore-backed storage.
  The bounded projection/query snapshot uses AsyncStorage, excludes named sensitive fields, and has
  a 24-hour maximum age and 512 KiB limit.
- Shared edge cache was absent. No Cloudflare Worker, KV, D1, R2, Queue, Durable Object, or Pages
  implementation existed at the baseline.

The hardening program therefore preserves the primary data path and adds only a selective gateway
for an explicit high-risk route matrix. See [network-and-data-inventory.md](network-and-data-inventory.md)
and [cloudflare-architecture.md](cloudflare-architecture.md).

## Baseline validation run

The following observations were made before implementation changes. They establish the starting
condition only; they are not final same-SHA evidence.

| Check                  | Baseline result                                                                  | Scope and limitation                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run check`        | PASS in approximately 81.5 seconds                                               | Clean baseline commit; must be rerun for the final implementation and committed candidate        |
| Node / npm             | `v26.7.0` / `11.19.0`                                                            | Local workstation; CI workflows select Node 22                                                   |
| Release tools          | `semgrep`, `gitleaks`, `maestro`, and `k6` discovered                            | Presence is not a successful scan, device run, or load run                                       |
| `npm run guard:k6-env` | Expected fail-closed block                                                       | `K6_SUPABASE_URL` and `K6_SUPABASE_ANON_KEY` were absent                                         |
| SQL tooling            | `psql` and global `supabase` absent from shell PATH                              | More importantly, no same-SHA isolated staging DB URL/credentials or restore target was supplied |
| Device automation      | No attached Android device/emulator established; ADB absent from this shell PATH | Maestro/runtime/accessibility evidence unavailable                                               |
| iOS                    | No committed `ios/` tree and this is a Windows host                              | No IPA archive, TestFlight, signing, entitlement, or device evidence                             |

At current inventory time the shared implementation tree contains 323 focused test files across the
mobile, utilities, Supabase contract tests, and Worker tests, and 59 ordered SQL migrations including
the new replay-protection migration. File count is inventory, not proof that the final suite passed.

## OTA and artifact baseline

Source configuration shows Android updates enabled with update URL
`https://u.expo.dev/c7565eaa-d013-430f-9576-217c4beefa3f` and runtime `1.0.133`. This proves only
source intent. No current published AAB/APK/IPA was found in `artifacts/` or `release-evidence/`, and
there is no published-binary inspection report for Android or iOS.

Consequences:

- do not claim that installed Android or iOS users can receive an OTA;
- do not claim update code-signing or invalid-signature behavior;
- the current hardening range includes EAS/environment and infrastructure changes and is not a
  production OTA candidate for older binaries;
- a signed binary/runtime and both-platform artifact inspection are required before a later pure
  `OTA_SAFE` range can be promoted.

The fail-closed classifier and exact evidence contract are documented in
[ota-runtime-and-release.md](ota-runtime-and-release.md).

## Baseline release gaps

The following were absent at the start and remain release gates until attached to the same immutable
candidate SHA:

1. signed Android and iOS artifacts plus provenance, runtime/channel/update inspection, symbols, and
   checksums;
2. isolated preview/staging deployment with migration replay, DB lint, RLS/IDOR personas, query plans,
   pool/lock observations, realistic k6 runs, and dump/restore drill;
3. Android and iOS real-device matrices for P0 flows, offline/process death, deep links/push,
   accessibility, startup/FPS/memory, battery, and thermal behavior;
4. Cloudflare account/zone/DNS/WAF/secrets, preview traffic, origin observe/enforce cutover, gradual
   deployment, and rollback evidence;
5. EAS preview/production environment protection, published-binary OTA capability, staged update
   health, and previous/embedded rollback evidence;
6. Sentry release health, source maps/native symbols, PII-redaction sampling, alerts, and incident
   drill;
7. Play Internal Track/TestFlight, store privacy/UGC forms, backup/PITR status, owner approvals, and a
   signed GO/NO-GO record.

The executable manual sequence is [MANUAL_STEPS.md](MANUAL_STEPS.md). Until those gates and the final
automated rerun are bound to one SHA, the truthful decision is `NO-GO`.
