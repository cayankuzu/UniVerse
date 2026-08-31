# AAA-MVP release readiness

Updated: 2026-08-31
Baseline commit: `227329989bd937faff48c54291aeefc8b3942515`
Target version/runtime: `1.0.134` / `1.0.134`

## Current decision

**RELEASE NO-GO.** Repository implementation and local verification are complete for the candidate
prepared for `main`. This is not release approval: no immutable current-SHA evidence bundle contains
signed Android+iOS artifacts, isolated staging/DB/load results, two-platform real-device results,
provider dashboards/alerts, store review, restore, gradual rollout, or rollback rehearsal.

No numeric baseline or final score is assigned below. The master quality rule permits `9.80` only
when code, automation, runtime, and operational evidence are complete for the same immutable SHA.
Using a guessed `9.x` would conceal release blockers. `Unscored` therefore means "not certified at
9.80," and every affected row remains `NO-GO`.

The older [production-10-10-readiness-status.md](production-10-10-readiness-status.md) is historical
working-tree evidence from 2026-08-19. Its tests and scores must not be relabeled as evidence for this
candidate.

## Final local repository verification (2026-08-31)

- `npm run check` and `npm run security:verify:internal` passed. Expo Doctor passed `20/20`; dependency
  audit retained only the two approved build-only `image-size` advisories expiring 2026-09-30.
- ESLint, full-tree Prettier, Semgrep (`0` findings), and current-tree/history Gitleaks (`0` leaks)
  passed.
- The final Jest coverage run passed `319/319` suites and `1036/1036` tests. Aggregate coverage was
  `51.01%` statements, `39.95%` branches, `50.53%` functions, and `53.13%` lines.
- Android `gradlew clean`, `bundleRelease`, and `assembleRelease` completed successfully for
  `1.0.134 (134)`. The signed local AAB is `87,850,858` bytes with SHA-256
  `3C9CA1B7EB6EE04697DDD195293DE5176047AB4A995FF316682AF514D10A394C`; `jarsigner` verified its
  signature. An empty Android emulator installed that release APK, reported version `1.0.134 (134)`,
  launched with a live process, and produced no fatal startup crash.
- Local Sentry symbol/mapping upload was deliberately disabled after the workstation token returned
  `401`; the runtime SDK remains packaged. Provider-side symbolication and release health therefore
  remain E6, not local build evidence.
- No Docker was used. Isolated Supabase migration/RLS validation, credentialed k6, iOS signing/device
  coverage, provider inspection, and rollout/rollback rehearsals remain external evidence gaps below.

## Feature-freeze comparison

| Protected surface                                         |   Baseline | Current guarded source | Result           |
| --------------------------------------------------------- | ---------: | ---------------------: | ---------------- |
| Leaf routes / screens                                     |    24 / 24 |                24 / 24 | Same             |
| Navigator tabs / visible bottom keys                      |      3 / 4 |                  3 / 4 | Same             |
| Deep-link mappings / modal-wrapper mounts                 |     2 / 59 |                 2 / 59 | Same fingerprint |
| Notification types / filters / Android channels           | 11 / 5 / 1 |             11 / 5 / 1 | Same             |
| Runtime permission keys / settings groups / settings CTAs |  4 / 3 / 7 |              4 / 3 / 7 | Same             |
| Product-domain tables / Storage buckets                   |     16 / 1 |                 16 / 1 | Same             |

The one additional migration table, `cloudflare_origin_request_nonces`, is an RLS-forced internal
replay ledger and not a product domain. The reports migration adds only optional idempotency columns
and a per-reporter uniqueness constraint to the existing product table. The full contract and diff are
[existing-feature-contract.md](existing-feature-contract.md) and
[no-new-feature-audit.md](no-new-feature-audit.md). Final guard output must still be captured from the
committed candidate; source inventory alone is not signed-artifact/runtime proof.

## Implementation map

- **Feature freeze:** machine snapshot, source-surface guard and self-tests; no user-facing screen,
  tab, route, CTA, settings group, notification type, permission, admin panel, or product table.
- **Selective Cloudflare:** one Worker with exact route/method/body/JWT/rate-limit/CORS/no-store
  policy, HMAC origin signing, replay protection, Worker tests, preview/gradual production workflows,
  and explicit direct-origin rollback. No cache/KV/D1/R2/Queue/Durable Object/Pages.
- **Supabase:** migration-first nonce ledger/RPC, origin verifier, and report-submission idempotency;
  PostgreSQL/RLS remains source of truth. Projection reads and follow/block/status paths stay
  direct/SQL-RPC-first. Production auth recovery/password fallbacks remain unmounted. Moderation
  mail contains only the case ID and categorical metadata; protected evidence stays in PostgreSQL.
- **Mobile transport:** central optional gateway selection sends only the reviewed high-risk matrix
  through Cloudflare; empty gateway URL restores the compatible direct origin without a mutation
  retry or legacy-read bypass.
- **OTA:** fail-closed diff classifier/evidence writer, environment-isolated preview/production
  workflows, 5% production start, published-binary inspection contract, and previous/embedded
  rollback runbook. Because this implementation range includes EAS/native-adjacent and infra policy
  changes, the range itself is not a production OTA for old binaries.
- **Documentation:** baseline, feature contract/audit, network/data inventory, Cloudflare design and
  threat model, OTA policy/rollback, manual provider sequence, and this evidence-gated decision.

The current diff must be obtained from `git diff --name-status` after all agents finish and committed
as part of the evidence manifest; this summary is not a substitute for that machine diff.

## Evidence codes

| Code | Missing same-SHA evidence                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| E1   | Clean immutable candidate plus final check/lint/format/tests/coverage/SAST/current-tree and history secret scans/SBOM-provenance outputs |
| E2   | Signed Android and iOS artifacts, checksums, signing continuity, symbols, and published-binary OTA/runtime/channel inspection            |
| E3   | Real Android+iOS device matrix: P0 E2E, accessibility, startup/FPS/memory, offline/process death, push/deep links, battery/thermal       |
| E4   | Isolated staging migration replay, DB lint, RLS/IDOR personas, concurrency/query plans, k6/pool/lock, backup/PITR and Storage restore    |
| E5   | Cloudflare/Supabase provider state: zone/DNS/WAF/secrets, preview traffic, origin observe/enforce, leakage/adversarial and rollback run  |
| E6   | Sentry/Cloudflare/Supabase dashboards: release health, symbolication, PII sample, SLO baseline, alerts and incident drill                |
| E7   | GitHub environment protection, least-privilege credential review, TestFlight/Internal Track, privacy/UGC/store forms and approvals       |
| E8   | Observed Worker and OTA staged rollout, component-independent rollback, previous/embedded update, and final signed GO/NO-GO record       |

## 35-area status

|   # | Area                   | Baseline | Hardening / automated repository evidence                                                           | Runtime/operational evidence gap | Remaining risk                                                                 | Final    | Decision |
| --: | ---------------------- | -------- | --------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ | -------- | -------- |
|   1 | UI/UX                  | Unscored | Existing screens/states and UI guard remain; no redesign/product expansion                          | E1, E3                           | Visual/state regression on supported devices                                   | Unscored | NO-GO    |
|   2 | Multi-device           | Unscored | Responsive source/checklists exist                                                                  | E2, E3                           | Small/large, low/mid, Android/iOS matrix absent                                | Unscored | NO-GO    |
|   3 | Performance            | Unscored | Projection-first reads, bounded network/queues and performance guards remain                        | E3, E4, E6                       | No same-device cold/warm, p95, FPS, memory/network baseline                    | Unscored | NO-GO    |
|   4 | Security/privacy       | Unscored | RLS contracts, redaction, threat model, JWT/HMAC/replay and secret/SAST gates exist                 | E1, E4-E7                        | Provider secrets, adversarial staging, PII/incident and store privacy unproven | Unscored | NO-GO    |
|   5 | Architecture           | Unscored | Layer guard; Supabase source of truth; projection-first and rollback-compatible matrix              | E1, E4, E5                       | Deployed contract/cutover parity not observed                                  | Unscored | NO-GO    |
|   6 | DRY                    | Unscored | Shared transport, queue engine, UI primitives and narrow gateway modules are reused                 | E1                               | No final duplicate/complexity report bound to candidate                        | Unscored | NO-GO    |
|   7 | Hardcode/config        | Unscored | Central release/public-env schema; environment-separated Worker/EAS config; preview fails closed    | E1, E5, E7                       | Provider values/secrets and stable domain not provisioned                      | Unscored | NO-GO    |
|   8 | State                  | Unscored | Owner-scoped cache, optimistic rollback, persistent queue/stale-claim tests exist                   | E1, E3, E4                       | Two-device/race/process-death behavior incomplete                              | Unscored | NO-GO    |
|   9 | Network/API            | Unscored | Timeout/abort/body-once/auth refresh; exact gateway contract, request ID, no mutation retry         | E1, E4-E6                        | Real 429/outage/latency and origin parity not observed                         | Unscored | NO-GO    |
|  10 | Accessibility          | Unscored | Shared roles/labels/hit targets and source guards/checklists exist                                  | E3                               | VoiceOver/TalkBack, 200% font, keyboard, contrast/reduce-motion signoff absent | Unscored | NO-GO    |
|  11 | Scale                  | Unscored | k6/SQL validation contracts and distributed limiter configuration exist                             | E4, E5                           | Missing staging credentials/results, plans, pool/lock/limiter behavior         | Unscored | NO-GO    |
|  12 | Resilience             | Unscored | Persistent retries/dead-letter/stale recovery plus offline and OTA rollback runbooks                | E3-E6, E8                        | Provider outage, restore, process kill and rollback drills absent              | Unscored | NO-GO    |
|  13 | Tests                  | Unscored | Local final run passed 319 suites/1036 tests plus contract, Worker, and guard suites                | E1, E3-E5                        | No immutable CI bundle, DB/RLS runtime or two-platform mobile E2E evidence     | Unscored | NO-GO    |
|  14 | Localization           | Unscored | UTF-8/mojibake guard and frozen existing-language surface                                           | E1, E3, E7                       | Device truncation/copy/legal locale review absent                              | Unscored | NO-GO    |
|  15 | Offline                | Unscored | Bounded persisted query/queue contracts and owner purge; see offline contract                       | E3, E4                           | 24-hour replay, reinstall/user-switch, process kill and conflict matrix absent | Unscored | NO-GO    |
|  16 | Push/deep link         | Unscored | Frozen notification types; project-partitioned tokens/receipts and trusted auth-link state          | E3, E6, E7                       | Foreground/background/terminated, upgrade and provider lifecycle absent        | Unscored | NO-GO    |
|  17 | Observability          | Unscored | Release/runtime/channel tags, telemetry bounds and PII redaction exist                              | E5, E6                           | No live correlation, retention review, baseline SLO, alert or dashboard proof  | Unscored | NO-GO    |
|  18 | CI/CD                  | Unscored | Fail-closed checks and separate Cloudflare/EAS preview/production workflows                         | E1, E5-E8                        | GitHub protection, real run IDs, provider approvals and rollback not proven    | Unscored | NO-GO    |
|  19 | Documentation          | Unscored | Architecture, contracts, threat/OTA/rollback/manual/evidence docs updated                           | E1, E5-E8                        | Operational owner review and executed evidence links absent                    | Unscored | NO-GO    |
|  20 | Domain logic           | Unscored | Existing social/content/privacy/idempotency tests retained; no new domain                           | E1, E3, E4                       | Full invariant/property/adversarial concurrency matrix absent                  | Unscored | NO-GO    |
|  21 | Dependencies           | Unscored | Root/Worker lockfiles and audit/security policy; controlled narrow additions                        | E1, E7                           | Same-SHA audit/license/SBOM/provenance outputs; exceptions expire 2026-09-30   | Unscored | NO-GO    |
|  22 | Battery/resources      | Unscored | Bounded prefetch/realtime/background/queue work in source                                           | E3, E6                           | Physical-device battery, thermal, media and background measurement absent      | Unscored | NO-GO    |
|  23 | Platform compatibility | Unscored | Release/native parity and Expo Doctor gates; Android OTA source config exists                       | E1-E3                            | Signed entitlement/permission/update inspection on both platforms absent       | Unscored | NO-GO    |
|  24 | Store readiness        | Unscored | Store/rehearsal checklists and frozen identities exist                                              | E2, E3, E7                       | Signed artifacts, internal tracks, privacy/UGC forms and review absent         | Unscored | NO-GO    |
|  25 | Operational maturity   | Unscored | Runbooks, evidence layout, risk/owner/manual sequence exist                                         | E4-E8                            | RPO/RTO, alerts, incident/restore/canary/approval not executed                 | Unscored | NO-GO    |
|  26 | Readability            | Unscored | Mobile 500-line guard currently reports no violation; narrow typed modules                          | E1                               | Final complexity/naming review and guard output absent                         | Unscored | NO-GO    |
|  27 | General maturity       | Unscored | Repo hardening and rollback paths implemented                                                       | E1-E8                            | No live P0/P1 closure, canary, health or rollback proof                        | Unscored | NO-GO    |
|  28 | Code architecture      | Unscored | `app-shell/data/features/platform/shared` direction and projection ownership guarded                | E1, E4                           | Final boundary result and deployed data-contract parity absent                 | Unscored | NO-GO    |
|  29 | Code quality           | Unscored | Strict TypeScript/lint/format/static-analysis gates and redacted error boundaries                   | E1                               | Final zero-warning/full-tree/same-SHA outputs absent                           | Unscored | NO-GO    |
|  30 | KISS                   | Unscored | One narrow Worker; no cache/KV/D1/R2/Queue/DO/Pages or second data store                            | E4, E5                           | Real benefit/cost/latency and provider-operability not measured                | Unscored | NO-GO    |
|  31 | Code hardcode          | Unscored | Release/runtime, API bases, route matrix, limits and flags are centralized                          | E1, E5, E7                       | Stable root domain and reviewed provider values unresolved                     | Unscored | NO-GO    |
|  32 | Reuse                  | Unscored | Existing transport, storage, query, queue, telemetry and UI systems reused                          | E1, E3                           | Final UI/runtime regression and duplicate analysis absent                      | Unscored | NO-GO    |
|  33 | Code performance       | Unscored | Hot paths use projections, bounded request pool/cache and serialized queue/storage work             | E3, E4, E6                       | Profiling/query/upload regression budgets not measured on candidate            | Unscored | NO-GO    |
|  34 | Testability            | Unscored | Deterministic guards, injected Worker dependencies, contract/fault tests and synthetic staging plan | E1, E3-E6                        | Provider/device fault injection and final artifact outputs absent              | Unscored | NO-GO    |
|  35 | Extensibility          | Unscored | Versioned runtime/contracts, fail-closed classifier, explicit route policy and feature freeze       | E2, E4, E5, E8                   | Old-binary compatibility and rollback window not proven                        | Unscored | NO-GO    |

## Supabase, Cloudflare, and OTA release consequences

### Supabase

The forward migrations create only `cloudflare_origin_request_nonces`, its service-role-only claim
RPC with forced RLS, and optional report idempotency columns/constraints. The Edge Function verifier
supports `off -> observe -> enforce`; production
must not enter `enforce` until signed origin requests, old-client compatibility, replay rejection,
and rollback are observed. Migration replay, DB lint, RLS/IDOR, cleanup volume, and restore remain E4.

### Cloudflare

Only availability/registration, report creation, and upload-session create/finalize/cancel are in the
gateway matrix. All responses are private/no-store. Public projection caching is deliberately absent.
The production workflow supports independent `5/25/50/100` Worker rollout and previous-version
rollback, but no production version, domain, WAF rule, secret, traffic, or health window is asserted
as deployed. Those remain E5/E8.

### OTA/build

Android source says Updates is enabled, but neither published Android nor iOS artifact has been
inspected. The current range changes `eas.json`, package/guard policy, workflows, infrastructure,
Supabase, and network configuration; the fail-closed classifier therefore blocks treating the whole
range as a production OTA. Build/sign/inspect both platforms first. Only a later, clean, fully
`OTA_SAFE` JS range from the verified deployed base may use preview then `5/20/50/100` OTA rollout.

## Risk register

| ID  | Severity | Risk / trigger                                                          | Mitigation and owner                                              | Rollback                                                       | Closure evidence     |
| --- | -------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- | -------------------- |
| R1  | P0       | Results come from a dirty or different SHA                              | Release owner freezes one candidate and regenerates all evidence  | Reject candidate                                               | E1 manifest/tree SHA |
| R2  | P0       | Published binaries lack expected OTA/runtime/channel/signature          | Mobile release/security build and inspect both platforms          | Halt OTA; new binary/runtime                                   | E2                   |
| R3  | P0       | RLS/IDOR, account deletion, replay or origin enforcement leaks/bypasses | DB/Security run disposable personas and observe-first cutover     | Origin `observe/off`, previous Function/Worker; forward DB fix | E4/E5                |
| R4  | P0       | Backup exists but DB/Auth/Storage cannot restore                        | DR owner restores to isolated target and measures RPO/RTO         | Never point clients/reset prod; recover using approved backup  | E4                   |
| R5  | High     | Gateway DNS/WAF/rate limits block clients or expose origin              | Cloudflare owner uses preview/log mode and exact matrix           | Previous Worker/WAF/DNS; empty gateway URL                     | E5/E8                |
| R6  | High     | Current native/manual range is mistakenly published OTA                 | Release owner enforces classifier and published-binary gate       | Revert rollout; build corrected binary                         | E2/E8                |
| R7  | High     | No Android/iOS P0, accessibility, offline or performance proof          | QA/A11y/Perf execute signed-artifact matrix                       | Reject build/stop rollout                                      | E3                   |
| R8  | High     | Provider logs/telemetry contain PII or alerts do not fire               | Security/Observability sample redaction, retention and test alert | Disable affected integration/sampling; incident response       | E6                   |
| R9  | High     | Preview/prod credentials or data are shared                             | Security reviews protected environments and token scope           | Revoke/rotate; stop deploy                                     | E5/E7                |
| R10 | High     | Store privacy/UGC/signing metadata disagrees with binary                | Legal/Store owners review actual artifact and flows               | Halt submission/phased release                                 | E2/E7                |
| R11 | Medium   | Dependency exceptions expire on 2026-09-30 or provenance is absent      | Dependency owner upgrades or renews a reviewed bounded exception  | Block release                                                  | E1                   |
| R12 | Medium   | No measured load/pool/lock/battery/cost baseline                        | Performance/DB/Cloudflare owners measure isolated staging/devices | Stop promotion and tune with evidence                          | E3-E6                |

## Rollback map

| Component                 | First rollback                                                                                     | Must remain true                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Mobile selective gateway  | Restore empty `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL` in the compatible config/build/update           | No silent mutation retry; legacy reads remain disabled       |
| Cloudflare Worker/WAF/DNS | Protected workflow to previous version; disable exact new WAF rule; restore reviewed DNS binding   | Supabase remains source of truth; no open proxy/shared cache |
| Supabase origin verifier  | `enforce -> observe`; clear/drain gateway traffic before approved `off` or prior Function rollback | Migration stays forward; production DB is not reset          |
| Database migration        | Forward corrective migration or isolated PITR/restore incident process                             | Never drop/reset production as routine rollback              |
| EAS Update                | Revert active rollout, previous verified group, or verified embedded update                        | Exact channel/runtime/group; no mid-mutation forced reload   |
| Store binary              | Stop phased/internal distribution and ship a corrected signed runtime                              | Existing package/bundle/signing identity continuity          |
| Sentry/providers          | Disable/restore affected config; revoke/rotate exposed credential                                  | Preserve sanitized incident evidence; no secret in repo/log  |

Detailed provider commands and owners are in [MANUAL_STEPS.md](MANUAL_STEPS.md). OTA commands are in
[ota-rollback-runbook.md](ota-rollback-runbook.md). The existing offline/process-death boundary is
[offline-process-death-contract.md](offline-process-death-contract.md); observability design and
operations remain [mobile-observability-blueprint.md](mobile-observability-blueprint.md) plus
[production-runbook.md](production-runbook.md); credential incidents use
[credential-incident-response.md](credential-incident-response.md). These links are intentional so
the repository has one owner for each contract rather than duplicate runbooks.

## Exact external blockers

The unresolved external actions are Manual Steps 1-17: GitHub protections; Cloudflare account/zone/
root domain/DNS/WAF/secrets/traffic; isolated Supabase preview and origin cutover; EAS environment/
channel ownership; OTA signing decision and published artifacts; Android/iOS signing; Sentry health/
alerts; scanner/push/moderation/native provider credentials; staging DB/load/adversarial results;
physical device/accessibility/performance tests; TestFlight/Play Internal Track; privacy/UGC forms;
backup/PITR/Storage restore; canary and rollback approvals. None is marked complete.

`IMPLEMENTATION COMPLETE, RELEASE NO-GO UNTIL LISTED MANUAL/RUNTIME EVIDENCE IS ATTACHED TO THE SAME COMMIT SHA.`
