# Manual release steps

Updated: 2026-08-31

None of the checkboxes below is complete merely because repository code exists. Perform the steps
in order against one immutable candidate commit. Replace `<VERSION>`, `<FULL_SHA>`, IDs, domains,
and paths with observed values; never place a secret value in a command transcript or evidence
file. Store sanitized evidence under `release-evidence/<VERSION>/<FULL_SHA>/` as defined in
`release-evidence/README.md`.

The repository does not establish ownership of a root domain, Cloudflare account/zone, preview
Supabase project, provider dashboards, published mobile artifacts, or real devices. Those are exact
external blockers, not values to guess.

## Control-plane work already automated

This run created/verified the three GitHub environments, protected `main`, configured an independent
production reviewer, bound the four required checks to GitHub Actions, and created the missing EAS
`development`/`preview` channels and branches without deploying or publishing. The local Supabase
migration/RLS/restore and Docker validation layers require no provider secret. Exact non-secret
observations are in [provider-state-audit.md](provider-state-audit.md).

The checkboxes below remain open only where the complete safe result still needs an unavailable
secret, account/zone/domain choice, isolated paid/provider resource, independent human approval,
published artifact, store state, or physical device. Repeating the already completed control-plane
creation is not required; re-verify it against the final immutable SHA before release.

## 0. Freeze one release candidate and evidence root

- [ ] **Why:** every automated, artifact, runtime, and operational result must refer to one source
      and tree SHA.
- **Where:** GitHub repository and a clean full-history checkout after the reviewed branch is merged.
- **Values:** `<VERSION>`, `<FULL_SHA>`, `<TREE_SHA>`, owner, reviewer, release/rollback owner.
- **Verify:** run:

  ```powershell
  git fetch origin main --no-tags
  git checkout --detach <FULL_SHA>
  git rev-parse HEAD
  git rev-parse HEAD^{tree}
  git status --porcelain=v1
  git merge-base --is-ancestor <FULL_SHA> origin/main
  npm ci
  npm run check
  npm run security:verify:internal
  ```

- **Safe result:** exact SHAs match the candidate, the tree is clean, the candidate is in
  `origin/main`, and both commands pass. A dirty tree or detached local-only commit is not a
  production candidate.
- **Rollback:** no provider state has changed; reject the candidate and fix through a new reviewed
  commit.
- **Owner / evidence:** Release owner / `00-scope-and-adr/`, `02-tests-and-coverage/`, and
  `GO-NO-GO.md`.

## 1. Protect GitHub environments and credentials

- [ ] **Why:** reviewers, self-review prevention, branch protection, and required checks are now
      configured, but no GitHub environment secret exists and repository automation cannot invent or
      prove the least-privilege scope of provider credentials that were not supplied.
- **Where:** GitHub Settings -> Environments and branch protection/rulesets.
- **Values:** environments `development`, `preview`, `production`; separate `EXPO_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PREVIEW_API_TOKEN`, and
  `CLOUDFLARE_PRODUCTION_API_TOKEN`; required reviewers and protected branches/tags.
- **Verify:** with an authenticated GitHub CLI session:

  ```powershell
  gh api repos/cayankuzu/UniVerse/environments/preview
  gh api repos/cayankuzu/UniVerse/environments/production
  gh api repos/cayankuzu/UniVerse/rulesets
  ```

- **Safe result:** production continues to require an independent reviewer and prevents self-review;
  preview and production tokens are different and minimum-scope; secret values are not present in
  API output. The protection half is complete; the provider-credential half remains open.
- **Rollback:** remove/revoke the new credential, disable the affected deployment workflow, and
  restore the last reviewed environment rule configuration.
- **Owner / evidence:** Repository administrator + Security / `01-security/github-environments/`.

## 2. Provision Cloudflare account, zone, and least-privilege tokens

- [ ] **Why:** the repository can define a Worker but cannot create or prove the account, zone,
      billing/budget alerts, API token scope, or operator access.
- **Where:** Cloudflare Dashboard -> Account/Zone -> API Tokens, Workers & Pages, Notifications.
- **Values:** observed account ID, verified zone ID and root domain; distinct preview/production API
  tokens. Worker deployment needs only the reviewed Workers script/route read-write scopes and
  account/zone read scope. Use a separate narrowly scoped token for WAF changes.
- **Verify:** from `infra/cloudflare/universe-edge` with the corresponding environment credential in
  the process environment:

  ```powershell
  npx wrangler whoami
  npx wrangler deployments list --env preview
  npx wrangler deployments list --env production
  ```

- **Safe result:** the expected account is shown; a preview token cannot deploy production; a
  production deployment token cannot administer unrelated zones; budget/quota notifications have
  an owner.
- **Rollback:** revoke the new tokens and delete only an unused, newly created Worker after verifying
  that it carries no production traffic. Never delete the zone as a rollback.
- **Owner / evidence:** Cloudflare platform owner + Security / `01-security/cloudflare-access/` and
  `10-rollout-rollback/cloudflare/`.

## 3. Bind the stable API hostname and DNS

- [ ] **Why:** mobile cutover needs a stable `api.*` hostname whose ownership is proven. The repo has
      no verified `<ROOT_DOMAIN>`, so it intentionally does not invent one.
- **Where:** Cloudflare DNS and Workers Custom Domains/Routes.
- **Values:** `api.<ROOT_DOMAIN>`, zone ID, production Worker route, previous DNS target, TTL, and DNS
  rollback owner. Do not change package/bundle IDs or the Supabase project identity.
- **Verify:** after the custom domain is bound:

  ```powershell
  Resolve-DnsName api.<ROOT_DOMAIN>
  Invoke-WebRequest -Method Get -Uri https://api.<ROOT_DOMAIN>/health -TimeoutSec 10
  ```

- **Safe result:** trusted TLS, expected zone/Worker, generic healthy response, private/no-store
  headers, and no secret/upstream detail. The hostname is entered as
  `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL` only in the intended environment.
- **Rollback:** clear the mobile gateway value to return the allowlisted calls to the compatible
  direct Supabase origin, then restore the previous DNS/Worker binding. Keep
  `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`.
- **Owner / evidence:** DNS/Cloudflare owner + Mobile release owner /
  `10-rollout-rollback/cloudflare/dns/`.

## 4. Configure WAF and validate rate limits

- [ ] **Why:** Worker bindings provide distributed application abuse budgets, while zone WAF rules
      are external state and must be tuned without blocking legitimate native traffic.
- **Where:** Cloudflare Security -> WAF/Custom Rules/Managed Rules and Worker Rate Limiting metrics.
- **Values:** exact host, methods and paths from `docs/cloudflare-route-matrix.md`; body ceilings;
  rule IDs; preview observation window; emergency-disable owner. Do not place the native API behind
  Cloudflare Access unless an already existing browser client requires it and has been tested.
- **Verify:** start preview rules in log mode, exercise every allowlisted method/path and a bounded
  wrong-method/body/schema/rate-limit matrix, then inspect Worker/WAF logs for outcome, `cf-ray`, and
  false positives. Run the local contract suite too:

  ```powershell
  npm run cloudflare:check
  ```

- **Safe result:** legitimate native no-`Origin` requests pass; unknown routes/wrong methods and
  invalid bodies fail closed; `429` includes bounded `Retry-After`; logs contain no token, raw
  e-mail/user/IP, body, or query value.
- **Rollback:** disable the exact new WAF rule IDs or restore their prior log-only action, then use
  the previous Worker deployment. Do not weaken RLS or origin authorization.
- **Owner / evidence:** Security + Cloudflare platform owner / `01-security/cloudflare-waf/`.

## 5. Provision isolated Supabase preview and origin HMAC

- [ ] **Why:** preview values in `wrangler.jsonc` are deliberate `.invalid` placeholders; the replay
      migration, RLS, origin verifier, and selected route contracts must be exercised before production.
- **Where:** isolated Supabase preview project, Supabase Project Secrets, and a reviewed repository
  change replacing only preview public URLs/issuer values.
- **Values:** preview project ref/URL/anon key; `SUPABASE_SERVICE_ROLE_KEY`;
  `ORIGIN_HMAC_SECRET`; `CLOUDFLARE_ORIGIN_VERIFICATION_MODE` (`off`, then `observe`, later
  `enforce`); `CLOUDFLARE_ORIGIN_MAX_CLOCK_SKEW_SECONDS`; `EDGE_ALLOWED_ORIGINS` where applicable.
  The HMAC value must match its paired Cloudflare environment, be at least 32 random bytes, and
  differ between preview and production.
- **Verify:** deploy migrations first, then the Edge Function with verifier mode `off`; set Worker
  secrets interactively and inspect metadata only:

  ```powershell
  npm run release:sql:validate
  npx wrangler secret list --env preview
  npm run deploy:functions
  ```

  Then change preview to `observe`, run the selected-route contract/adversarial matrix, confirm
  nonce replay rejection and a fresh nonce/signature on the bounded GET retry. From two approved
  test networks, confirm origin budgets do not collapse into one Worker egress-IP subject; verify
  that any stored rate-limit subject is only the HMAC-bound opaque network key and that logs contain
  neither it nor raw IP. Query only aggregate/metadata evidence for
  `cloudflare_origin_request_nonces`.

- **Safe result:** migration replay is idempotent; forced RLS and grants are correct; direct old
  clients remain compatible while observing; valid Worker requests correlate; reused/expired/bad
  signatures fail; no production data is present in preview.
- **Rollback:** restore verifier `observe` or `off` and the prior compatible Edge Function. Migrations
  are forward-only; do not drop the nonce table or reset production. Rotate a suspected HMAC secret
  on both ends before resuming.
- **Owner / evidence:** Database/Supabase owner + Security / `06-load-and-database/` and
  `01-security/origin-hmac/`.

## 6. Configure Cloudflare secrets and deploy preview

- [ ] **Why:** each Worker environment requires independent runtime secrets and an actual preview
      deployment; local Worker tests do not prove provider behavior.
- **Where:** Cloudflare Worker secrets and GitHub `preview` environment.
- **Values:** preview `ORIGIN_HMAC_SECRET`, `RATE_LIMIT_SALT`, `SUPABASE_PUBLISHABLE_KEY`, public
  preview Supabase URLs/issuer, and exact existing browser origins if any.
- **Verify:** dispatch `.github/workflows/cloudflare-preview.yml`, retain its SHA-bound artifact, then:

  ```powershell
  npx wrangler versions list --env preview
  npx wrangler tail --env preview
  ```

  Exercise every row in the route matrix with preview users A/B and a blocked pair.

- **Safe result:** preview deploy contains no `.invalid` upstream; no open proxy/cache leakage;
  selected calls reach the correct preview origin with signature/replay evidence; direct projection
  reads bypass the Worker.
- **Rollback:** deploy the prior preview version, move origin mode to `observe`, and clear the
  preview gateway URL. Drain Worker traffic before selecting `off` or restoring the prior compatible
  Function.
- **Owner / evidence:** Cloudflare platform owner + QA / `10-rollout-rollback/cloudflare/preview/`.

## 7. Provision EAS environments, owner, project, and channels

- [ ] **Why:** source config names the project/channels, but provider environment values, token
      ownership, and channel/build mapping are not proven.
- **Where:** Expo/EAS project `cayanns-team/universe`, EAS Environments and Channels.
- **Values:** environments/channels `development`, `preview`, `production`; environment-specific
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL`, `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL`,
  `EXPO_PUBLIC_SENTRY_DSN`, release identity values, and
  `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`. Do not put secrets in `EXPO_PUBLIC_*`.
- **Verify:** using the protected environment token:

  ```powershell
  npx --yes eas-cli@23.0.0 whoami --non-interactive
  npx --yes eas-cli@23.0.0 project:info --non-interactive
  npx --yes eas-cli@23.0.0 channel:list --json --non-interactive
  npx --yes eas-cli@23.0.0 env:list --environment preview --non-interactive
  npx --yes eas-cli@23.0.0 env:list --environment production --non-interactive
  npm run guard:release-config-parity
  ```

- **Safe result:** identity is exactly the existing project; preview and production values/tokens
  are isolated; legacy reads remain disabled; no secret value appears in logs.
- **Rollback:** restore the previous environment value/channel mapping and clear the optional gateway
  URL. Do not repoint production to preview or change the EAS project ID.
- **Owner / evidence:** Mobile release owner + Expo account owner / `00-scope-and-adr/eas/`.

## 8. Decide OTA code signing and inspect published binaries

- [ ] **Why:** source Android OTA configuration is not proof that installed Android/iOS binaries
      have updates enabled, the right runtime/channel, or a trusted update certificate.
- **Where:** Expo account plan, protected signing system, published Play/TestFlight artifacts, and a
  reviewed native configuration change if signing is introduced.
- **Values:** artifact references and SHA-256, inspection tool/version, observed update URL/runtime/
  channel/enabled state for both platforms; certificate fingerprint/expiry; protected private-key
  secret name only.
- **Verify:** inspect the actual published AAB/APK and IPA/TestFlight builds, then create the schema
  defined in `docs/ota-runtime-and-release.md` at
  `release-evidence/published-binaries/<FULL_SHA>.json`. If code signing is supported/configured,
  exercise valid, invalid, expired, and wrong-certificate updates on compatible devices.
- **Safe result:** both platforms independently prove update URL
  `https://u.expo.dev/c7565eaa-d013-430f-9576-217c4beefa3f`, runtime `1.0.134`, production channel,
  enabled state, checksum, and provenance. A signing certificate first added to a binary is treated
  as `NATIVE_BUILD_REQUIRED`; its private key exists only in the protected production store.
- **Rollback:** if signing is not safely supported, do not claim it and ship a reviewed new runtime/
  binary before OTA. On key/certificate mismatch, stop publishing; do not bypass verification.
- **Owner / evidence:** Mobile security + Release owner / `03-android/`, `04-ios/`, and
  `01-security/ota-signing/`.

## 9. Produce signed Android and iOS candidates

- [ ] **Why:** the current repository has no same-SHA signed AAB/APK/IPA. This hardening range contains
      EAS/environment changes classified native/manual, so it cannot be sent wholesale as an OTA to old
      binaries.
- **Where:** EAS Build, Apple signing/App Store Connect, Android Play App Signing, protected file
  secrets.
- **Values:** existing package/bundle ID `com.ogrencisosyalagi.app`; version/runtime `1.0.134` and
  Android/iOS build identity `134`; `EXPO_IOS_GOOGLE_SERVICES_FILE`,
  `EXPO_ANDROID_GOOGLE_SERVICES_FILE`, `EAS_ASC_API_KEY_PATH`; existing signing identity
  fingerprints and build IDs.
- **Verify:** after all native/runtime changes are committed to the candidate:

  ```powershell
  npx --yes eas-cli@23.0.0 build --profile preview --platform all --non-interactive
  npx --yes eas-cli@23.0.0 build:view <BUILD_ID> --json
  Get-FileHash -Algorithm SHA256 -LiteralPath <DOWNLOADED_ARTIFACT_PATH>
  ```

  Production build/submit occurs only after preview acceptance and protected approval.

- **Safe result:** both artifacts are signed by the existing identities; package/bundle/version/
  runtime/channel/permissions/entitlements/update metadata match source; source maps, Android mapping
  and iOS dSYM are attached to the same SHA.
- **Rollback:** stop submission/phased release. Never rotate store identities as a routine rollback;
  correct the native issue in a new signed binary/runtime.
- **Owner / evidence:** Android/iOS release owners / `03-android/` and `04-ios/`.

## 10. Configure Sentry and prove redaction/alerts

- [ ] **Why:** source redaction and tags do not prove ingestion, symbolication, provider retention,
      PII absence, or working alerts.
- **Where:** isolated preview and production Sentry projects/environments and protected GitHub/EAS
  secrets.
- **Values:** `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`; release,
  commit SHA, runtime, channel/environment tags; approved sampling/retention; alert owners.
- **Verify:** on the preview signed build trigger the existing release-health event and a controlled
  test exception, inspect the payload for PII/token/signed-URL absence and a symbolicated stack, then:

  ```powershell
  npm run release:sentry:verify
  ```

  Confirm the test alert arrives and link it to the incident runbook.

- **Safe result:** correct release/dist/environment; source map/native symbols resolve; replay is
  disabled or fully masked per policy; no secret/e-mail/raw IP/message/media appears; the alert has
  an acknowledged owner.
- **Rollback:** disable the affected DSN/sampling integration or restore previous alert/sampling
  config, revoke the upload token if exposed, and follow `docs/credential-incident-response.md`.
- **Owner / evidence:** Observability owner + Security / `08-observability/`.

## 11. Provision remaining existing-flow providers

- [ ] **Why:** media scanning, push receipts, moderation delivery, and native Firebase configuration
      depend on provider state that cannot be synthesized locally. No new paid vendor is mandatory.
- **Where:** Supabase secrets, Expo Push, the approved scanner, Brevo/SMTP if used, Firebase/Google
  service configuration, and EAS file secrets.
- **Values:** `MEDIA_SCAN_WEBHOOK_URL`, `MEDIA_SCAN_WEBHOOK_TOKEN`, `MEDIA_SCAN_TIMEOUT_MS`,
  `EXPO_ACCESS_TOKEN`, `PUSH_DISPATCH_WEBHOOK_SECRET`, moderation sender/recipient and either Brevo or
  SMTP credential names, and both Google services file-secret names. Keep preview/production values
  distinct.
- **Verify:** with synthetic preview data, record scanner pass/fail/timeout/checksum mismatch,
  upload quarantine/finalize/cancel/cleanup, push send/ticket/receipt/inactive-token handling, and one
  sanitized moderation delivery. Verify the Android/iOS service files belong to the existing app ID.
- **Safe result:** scanner is fail-closed; push is environment/project partitioned; moderation failure
  is recorded server-side; no report snapshot or credential leaks to email/log evidence; native files
  are injected and not committed.
- **Rollback:** revoke/rotate only the affected provider credential, halt new upload confirmation if
  scanner trust is lost, pause push/moderation side effects without changing product source of truth,
  and restore the previous file-secret version.
- **Owner / evidence:** Backend operations + Mobile release + Security / `01-security/providers/` and
  `08-observability/providers/`.

  The source-level push contract, lifecycle, retry/receipt boundary, physical-device matrix, and
  credential-rotation procedure are [push-current-contract.md](push-current-contract.md),
  [push-provider-and-token-lifecycle.md](push-provider-and-token-lifecycle.md),
  [push-outbox-retry-receipt-dlq.md](push-outbox-retry-receipt-dlq.md),
  [push-real-device-matrix.md](push-real-device-matrix.md), and
  [push-incident-and-credential-rotation-runbook.md](push-incident-and-credential-rotation-runbook.md).

## 12. Deploy isolated staging and run DB/load/security matrices

- [ ] **Why:** local code tests do not prove migrations, RLS/IDOR, locks, pool behavior, provider
      failure, rate limiting, or recovery under realistic traffic.
- **Where:** isolated preview Supabase/Cloudflare/EAS/Sentry environments with synthetic accounts and
  no production data.
- **Values:** `SUPABASE_DB_URL`; all required `K6_*` variables from
  `docs/env-parity-checklist.md`; synthetic anon/user-A/user-B/blocked/club/service-role fixtures;
  observed baseline and approved budgets.
- **Verify:** deploy in the order migration -> Edge Function (`off/observe`) -> preview Worker ->
  preview mobile build/update, then run:

  ```powershell
  npm run release:sql:validate
  npm run loadtest:rehearsal:full
  npm run security:sast
  npm run security:secrets
  npm run security:secrets:history
  ```

  Capture `EXPLAIN (ANALYZE, BUFFERS)`, pool/lock/limiter behavior, selected-route contract parity,
  user-A/user-B/block/privacy, duplicate mutation, upload finalize/cancel race, provider outage, and
  rollback results.

- **Safe result:** no cross-user/blocked leakage, duplicate mutation, unbounded retry, scan bypass,
  lock/pool failure, or hidden legacy read. Thresholds are based on observed data, never invented.
- **Rollback:** stop load, restore the previous Worker/Function/app config, keep forward migrations,
  and rebuild the disposable preview project if fixtures are contaminated.
- **Owner / evidence:** Database + Backend + Performance + Security / `06-load-and-database/` and
  `01-security/adversarial/`.

## 13. Complete the real-device matrix

- [ ] **Why:** UI/UX, multi-device, accessibility, performance, offline, process death, push/deep
      link, battery, and OTA behavior cannot be certified by Jest or source inspection.
- **Where:** signed preview artifacts on supported physical Android and iOS phones, including
  small/large and low/mid capability devices.
- **Values:** device model/OS/build ID/artifact hash; Android 320/360/390/430 dp, gesture/3-button
  navigation, 100/150/200% font; corresponding supported iOS sizes; network profiles; test accounts;
  operator and UTC timestamps.
- **Verify:** execute `docs/manual-smoke-checklist.md`, `docs/performance-verification-checklist.md`,
  the P0 auth/projection/social/event/album/upload/notification/settings/report/block/deletion flows,
  and:

  ```powershell
  npm run maestro:test:critical
  ```

  Add VoiceOver/TalkBack, keyboard, touch targets, contrast, reduce motion, cold/warm/offline launch,
  reconnect, process kill/relaunch, 24-hour replay, memory/FPS/battery/thermal, push foreground/
  background/terminated, and auth/reset deep-link checks.

- **Safe result:** every supported matrix row links video/log/screenshot/metric evidence for the exact
  artifact SHA; no screenshot contains private user data. A test file or emulator-only pass is not a
  two-platform result.
- **Rollback:** reject the candidate, stop rollout, and fix through a new reviewed commit/build.
- **Owner / evidence:** Mobile QA + Accessibility + Performance / `07-accessibility-ux/`,
  `05-performance/`, `03-android/`, and `04-ios/`.

## 14. Exercise TestFlight and Play Internal Track

- [ ] **Why:** store processing, signing, install/upgrade, entitlement/permission parity, and review
      diagnostics differ from local artifacts.
- **Where:** App Store Connect TestFlight and Google Play Internal Testing/Pre-launch Report.
- **Values:** immutable build IDs, artifact hashes, tester groups, previous supported build, release
  notes limited to existing-feature hardening.
- **Verify:** install fresh and upgrade from the verified previous production build; repeat critical
  smoke, offline/update selection, push/deep links, account deletion, permission prompts, crash/
  symbolication, and review Play pre-launch/TestFlight diagnostics.
- **Safe result:** both stores serve the intended signed artifact; upgrade preserves compatible data
  and session boundaries; no unexpected permission/entitlement/product surface appears.
- **Rollback:** halt internal/phased distribution, remove testers from the bad build where supported,
  and prepare a corrected signed binary. Do not relabel a different artifact as the same SHA.
- **Owner / evidence:** Store release owners + QA / `09-store-privacy/internal-tracks/`.

## 15. Complete privacy, UGC, and store forms

- [ ] **Why:** source behavior does not submit Apple privacy nutrition, Google Data Safety, age/content
      ratings, UGC moderation disclosures, account deletion, export/access, or legal retention forms.
- **Where:** App Store Connect, Play Console, approved legal/privacy records, and existing support/
  legal surfaces only. Do not add a new public page or product UI under this hardening task.
- **Values:** actual data categories from `docs/network-and-data-inventory.md`; purpose, sharing,
  retention/deletion, encryption, Sentry/Expo/Supabase/Cloudflare/provider disclosure; UGC report/
  block/contact and account deletion behavior.
- **Verify:** Legal/Security/Product review the forms against a packet capture, provider inventory,
  permissions, and real deletion/export exercise. Compare published store declarations to the exact
  signed artifact.
- **Safe result:** no location/calendar/contacts/biometric/payment/advertising claim is added unless
  present; private media and identifiers are correctly classified; existing report/block/account
  deletion paths satisfy the reviewed policy.
- **Rollback:** return forms/build to draft or halt submission. A legal gap is a release block, not a
  reason to invent a new screen.
- **Owner / evidence:** Privacy/Legal + Store owners / `09-store-privacy/`.

## 16. Prove backup, PITR, and restore

- [ ] **Why:** configured backups are not a restore. PostgreSQL PITR also does not automatically
      prove Auth, private Storage objects, secrets, Edge config, or provider recovery.
- **Where:** Supabase project backup/PITR controls and a new isolated restore project; provider secret
  inventory; private Storage recovery process.
- **Values:** observed backup schedule/retention, restore point, source and isolated target refs,
  encrypted export location where approved, measured RPO/RTO, data owner, and deletion deadline for
  the restored environment. Never place production credentials or raw dumps in git.
- **Verify:** restore to the isolated target, run all SQL validation/parity/RLS checks, sample object
  checksums and signed access, verify Auth/Edge/provider configuration separately, then record start/
  finish times and sanitized counts/hashes.
- **Safe result:** expected rows/objects and RLS contracts recover within measured RPO/RTO; restored
  data is access-restricted and deleted under the approved policy after the drill.
- **Rollback:** do not point clients at a failed restore and never reset production. Destroy only the
  verified isolated restore target through the provider's approved process after evidence and legal
  retention requirements are satisfied.
- **Owner / evidence:** Database/DR owner + Security / `06-load-and-database/restore/` and
  `10-rollout-rollback/dr/`.

## 17. Rehearse canary, independent rollback, and final approval

- [ ] **Why:** gradual rollout and rollback are operational actions. Workflow code cannot prove
      observed health, reviewer approval, provider state, or device recovery.
- **Where:** protected Cloudflare production workflow, protected EAS production workflow, Supabase,
  Sentry, stores, and incident channel.
- **Values:** candidate/previous Worker version IDs; OTA base/candidate/group/update IDs; production
  health URL; observed baseline and health evidence reference; approver; incident and rollback
  owners.
- **Verify:** first rehearse rollback in preview. For production, upload the Worker version and use
  protected `5% -> 25% -> 50% -> 100%` actions only after each observation window. A future pure OTA
  range uses preview first, then production `5% -> 20% -> 50% -> 100%` with the published-binary
  inspection requirement. Run the final fail-closed gate:

  ```powershell
  npm run release:verify
  ```

  Rehearse Worker previous-version rollback, origin `observe/off`, empty mobile gateway, OTA active
  rollout revert, previous update, embedded update, Edge Function rollback, and DB restore without
  enabling legacy primary reads. Follow `docs/ota-rollback-runbook.md` and
  `docs/production-runbook.md`.

- **Safe result:** every stage has same-SHA provider/runtime/device/Sentry evidence; each rollback
  restores observed health; all secrets remain redacted; `GO-NO-GO.md` is signed by required owners.
- **Rollback:** stop promotion immediately; restore the exact previous component version/group;
  preserve incident output and checksums. Database migrations remain forward-only and production is
  never reset.
- **Owner / evidence:** Incident commander + Release owner + component owners /
  `10-rollout-rollback/` and `GO-NO-GO.md`.

## Current status

GitHub environments/protection and the missing EAS development/preview channels were provisioned
automatically without publishing or deploying. Local migration/RLS validation and a disposable
PostgreSQL restore drill were also executed without touching production. The exact non-secret
observations are recorded in [provider-state-audit.md](provider-state-audit.md).

Cloudflare deployment/secrets/DNS/WAF, an isolated preview Supabase target, same-SHA signed iOS,
published-binary OTA inspection, provider dashboards, physical-device coverage, stores, production
backup/PITR/Storage recovery, canary rollback, and independent release approval remain unverified.
Repository implementation alone therefore cannot change the release decision from `NO-GO`. See
[release-readiness.md](release-readiness.md) for the area-by-area mapping.
