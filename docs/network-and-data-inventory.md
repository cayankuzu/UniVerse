# Network and data inventory

Updated: 2026-08-30

## Scope and invariants

This inventory records existing data movement; it does not authorize a new product surface or a
second source of truth. Supabase Auth, PostgreSQL/RLS, projection SQL/RPC, Realtime, and private
Storage remain authoritative. Mobile read-heavy flows remain projection-first, and follow, block,
status, feed, search, profile, notification reads, Realtime, and private media do not gain a legacy
Edge fallback.

```text
Mobile app
├─ direct Supabase: Auth, projection/RPC, scoped writes, Realtime, private Storage
├─ optional selective Worker: exact auth/report/upload-session method+path allowlist
│  └─ signed request to the same Supabase Edge Function and user/RLS context
├─ Expo: update selection/download and push-token acquisition/delivery transport
└─ Sentry: redacted crash, trace, release, and optional masked replay telemetry

Supabase Edge Function
├─ Supabase Auth/PostgreSQL/Storage
├─ Expo Push API: send tickets and fetch receipts
├─ configured media-scanner webhook: private upload metadata for verdict
└─ Brevo API or configured SMTP: existing moderation-report delivery
```

Cloudflare has no product database or shared response cache. No KV, D1, R2, Queue, Durable Object,
or Pages product is used. The one new PostgreSQL nonce table is internal replay protection, not
product data.

## Network destinations

| Caller                     | Destination / configuration                                         | Data sent                                                                                                               | Authentication                                                    | Source of truth / purpose                                                                   | Cache and failure policy                                                                                 |
| -------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Mobile Supabase client     | `EXPO_PUBLIC_SUPABASE_URL`                                          | Auth payloads, user-scoped RPC/row mutations, Realtime subscriptions                                                    | Public anon key plus user JWT where required                      | Supabase Auth/PostgreSQL/RLS/Realtime                                                       | Projection/query policy remains client-scoped; auth changes purge sensitive state                        |
| Mobile API transport       | `EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL`                           | Existing Edge Function request bodies and bearer token                                                                  | Public anon key plus anon/user token by route                     | Existing Hono Edge Function operations                                                      | Timeout/abort, body parsed once, bounded GET reuse; mutations are not blindly retried                    |
| Mobile selective transport | `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL`, empty by default              | Only the exact matrix in `cloudflare-route-matrix.md`                                                                   | Public key and user JWT; native requests may omit `Origin`        | Security/abuse gateway to the same Edge Function                                            | No shared cache; mutation failure does not silently retry direct; empty URL is explicit rollback         |
| Mobile Storage             | Supabase private Storage and resumable upload host                  | Media bytes, checksum/content metadata, signed URL requests                                                             | User JWT, upload ticket/session as applicable                     | Private bucket `make-e3557d40-media`                                                        | Short signed-URL cache; scan/quarantine/finalize contracts fail closed                                   |
| Mobile observability       | `EXPO_PUBLIC_SENTRY_DSN`                                            | Sanitized errors, breadcrumbs, release/runtime/channel tags, sampled traces; masked replay only if enabled              | Public DSN                                                        | Sentry is telemetry only                                                                    | `sendDefaultPii=false`; token/query/email redaction; provider retention still needs manual review        |
| Mobile updates             | `EXPO_PUBLIC_UPDATES_URL` / EAS project ID                          | Runtime/channel/update request metadata; JS/assets returned by Expo                                                     | Expo Updates runtime/channel selection                            | Expo/EAS distribution, never product data                                                   | Compatible runtime only; cached/embedded launch and rollback require artifact/device proof               |
| Mobile push registration   | Expo Notifications plus existing `/push/register` route             | Expo push token, platform, project/environment attribution, opaque installation UUID                                    | Platform/Expo transport and user JWT to origin                    | Supabase `push_device_tokens`; Expo delivers notifications                                  | Confirmed cleanup only; same-install account switch is server-side; physical lifecycle still needs proof |
| Cloudflare Worker          | Per-environment `SUPABASE_URL`, `JWT_ISSUER`, and `ORIGIN_BASE_URL` | Validated selected requests, request ID, HMAC v2 timestamp/per-attempt nonce/path/body hash, salted opaque network key  | User JWT validation; `ORIGIN_HMAC_SECRET`; public publishable key | Supabase remains authoritative                                                              | 8-second upstream budget; selected GET may retry once with a fresh nonce; private/no-store; fail closed  |
| Supabase Edge Function     | Expo Push send/receipt APIs                                         | Bounded notification title/body/deep-link identifiers, Expo tokens/ticket IDs                                           | Optional `EXPO_ACCESS_TOKEN`                                      | Existing notification delivery and receipt tables                                           | Bounded batches; retryable errors tracked; invalid tokens deactivated                                    |
| Supabase Edge Function     | `MEDIA_SCAN_WEBHOOK_URL`                                            | Private bucket name, object path, owner ID, media type and size; provider returns checksum/verdict                      | `MEDIA_SCAN_WEBHOOK_TOKEN`                                        | Existing upload quarantine/confirmation                                                     | 2-30 second bounded timeout (default 12 seconds); missing/error/invalid verdict fails closed             |
| Supabase Edge Function     | Brevo API or configured SMTP                                        | Case ID plus sanitized categorical reason/target type; no detail, snapshot, user identity, e-mail, or reply-to metadata | Brevo/SMTP server-side credentials                                | PostgreSQL report/audit state remains authoritative; email is an alert/delivery side effect | Missing provider config records skipped/failed delivery; no new admin panel                              |
| CI/release operator        | GitHub, EAS, Cloudflare, Supabase, Sentry, Apple/Google portals     | Source SHA, build/update metadata, checksums, sanitized evidence                                                        | Separate minimum-scope protected credentials                      | Deployment and evidence only                                                                | Environment-separated approvals; secrets never belong in artifacts                                       |

The Worker route-level auth, body limits, retry, rationale, and rollback are authoritative in
[cloudflare-route-matrix.md](cloudflare-route-matrix.md). Its threat and logging boundaries are in
[cloudflare-threat-model.md](cloudflare-threat-model.md).

Push ownership, provider boundaries, retry semantics, device evidence, and incident response are
documented separately in [push-current-contract.md](push-current-contract.md) so this inventory
does not duplicate their operational procedures.

## Data stores and classification

| Store                              | Data classes                                                                                                         | Sensitivity                                                                       | Owner/access boundary                                          | Known lifecycle                                                                                                            | Release gap                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Supabase Auth                      | Account identifiers, password verifier/provider state, sessions, reset/verification state                            | Restricted                                                                        | Supabase Auth; user/admin APIs only                            | Provider/session policy; account deletion flow exists                                                                      | Provider configuration, MFA/session policy, recovery email and deletion rehearsal not attached |
| `profiles`                         | Username, email visibility, university/department/grade, bio, account type, privacy, avatar/cover references         | Personal/restricted                                                               | RLS and projection/RPC visibility                              | Account lifecycle; exact legal retention not proven in repo                                                                | Data-access/export and retention owner approval required                                       |
| Social tables                      | Follows, blocks, memberships, attendance                                                                             | User-scoped/restricted                                                            | RLS, block/privacy predicates, transactional mutations         | Account/content lifecycle                                                                                                  | Disposable user-A/user-B/blocked adversarial matrix required                                   |
| Content tables                     | Events, album photos, comments, likes, engagement counters                                                           | Public-to-restricted depending on visibility/block state                          | RLS and projection response contracts                          | Content/account deletion and cleanup jobs                                                                                  | Staging RLS, concurrency, orphan cleanup and restore proof required                            |
| Moderation/security                | Reports, protected snapshots, per-reporter mutation key/fingerprint, delivery status, audit/detection signals        | Restricted operations data                                                        | Reporter RLS plus server/service role; no end-user admin panel | Email is case-ID/categorical only; repo does not prove provider/legal retention                                            | Retention schedule, access review, incident/appeal operations evidence required                |
| Notifications/push                 | Notification records, push device tokens, opaque installation correlation, dispatch queue, delivery tickets/receipts | Restricted device/account data                                                    | User RLS plus service-role delivery worker                     | Receipt processor uses a 15-minute eligibility window and 24-hour expiry; unconfirmed unregister retains local retry state | Provider token retention/deactivation and device lifecycle test required                       |
| Media and uploads                  | `media_assets`, upload sessions/items, cleanup jobs, object metadata, private media bytes                            | Restricted/content                                                                | Private Storage, RLS/service role, signed URLs, scanner        | Session/cleanup state machine exists; exact provider backup/retention requires confirmation                                | Scanner, quarantine, finalize/cancel race, cleanup and restore drill required                  |
| Projection/operation tables        | Counters, summary caches, mutation receipts, client telemetry                                                        | User-scoped/operational                                                           | RLS/service role by table/RPC                                  | Bounded by migration/config contracts where present                                                                        | Staging cleanup/cardinality and retention review required                                      |
| `cloudflare_origin_request_nonces` | Random nonce, bounded request ID/route ID, timestamps                                                                | Internal security metadata                                                        | Forced RLS; public/anon/auth revoked; service-role RPC only    | Expired claims are deleted when another nonce is claimed                                                                   | Production cleanup volume/collision monitoring and observe/enforce drill required              |
| Private Storage bucket             | Original/processed existing profile/event/album media                                                                | Restricted content                                                                | Private `make-e3557d40-media`; signed access only              | Account/content cleanup and storage jobs                                                                                   | PITR does not by itself prove object restore; separate Storage restore evidence required       |
| Native SecureStore                 | Access/refresh tokens, bounded auth profile snapshot, persistent mutation/upload queue payloads                      | Device-restricted                                                                 | Current app/user on device; no native insecure fallback        | Cleared on logout/account/auth boundary; queue terminal/cleanup policy by queue                                            | Lost-device, OS backup, reinstall, process-death and 24-hour replay matrix required            |
| AsyncStorage                       | Sanitized projection/query cache, local optimistic shadows, permission/onboarding preferences                        | Device-local; may contain user-scoped display data but no auth secret by contract | App sandbox; owner-scoped cache keys and purge boundary        | Query snapshot max age 24 hours, max size 512 KiB; other records follow feature lifecycle                                  | Device inspection and user-A/user-B residue test required                                      |
| Sentry                             | Redacted errors/traces, release tags, optional fully masked replay                                                   | Operational; should be de-identified                                              | Sentry project access                                          | Sampling is source-configured; retention is provider state                                                                 | Dashboard sampling, deletion/retention, PII sample and alert evidence required                 |
| Cloudflare telemetry               | Route ID, method, outcome/status, duration, environment, bounded request ID and `cf-ray`                             | Operational/de-identified                                                         | Cloudflare account/log access                                  | Sampling configured per environment; provider retention unverified                                                         | Dashboard/log-retention/PII review and budget alarm required                                   |
| Release evidence                   | Sanitized reports, hashes, run IDs, artifact metadata, screenshots                                                   | Internal; must exclude secrets/PII                                                | Protected repository/artifact access                           | Folder per version and immutable SHA                                                                                       | Current candidate bundle does not yet exist                                                    |

Product-domain table names and the complete route/RPC inventory are frozen in
[existing-feature-contract.md](existing-feature-contract.md). Infrastructure tables are not a
license to add a product domain.

## Secrets and public values

Public mobile values may be extracted from a binary and are not authentication: Supabase URL and
anon/publishable key, EAS project identity, update URL, Sentry DSN, and the optional gateway URL.
They use the `EXPO_PUBLIC_*` contract.

Server-only material must remain in provider secret stores:

- Supabase: `SUPABASE_SERVICE_ROLE_KEY`, `ORIGIN_HMAC_SECRET`, push webhook secret, media-scanner
  token, Expo access token, Brevo/SMTP credentials, and database URLs;
- Cloudflare: `ORIGIN_HMAC_SECRET`, `RATE_LIMIT_SALT`, `SUPABASE_PUBLISHABLE_KEY`, account ID and
  environment-specific API token;
- GitHub/EAS/release: `EXPO_TOKEN`, Sentry upload token, Apple/Android signing material, Google
  service file secrets, and store submission credentials.

The origin HMAC value must match between one Cloudflare environment and its paired Supabase
environment, but preview and production values must differ. Do not write secret values, raw tokens,
signed URLs, precise user identifiers, production dumps, or provider responses containing PII to
this document or release evidence.

## Logging and deletion boundaries

- Mobile and Edge redaction remove bearer/query secrets and mask email. Sentry deletes direct user
  email/name/IP fields and has default PII disabled.
- Worker structured logs intentionally omit request/response bodies, query values, bearer tokens,
  raw email/user/IP identifiers, and cookies.
- Provider-side log sampling and retention are not proven by source; they are a mandatory manual
  review.
- Account logout/account deletion must purge auth, owner-scoped caches, local shadows, and queues.
  Repository tests are not a production deletion or restore drill.
- Release evidence accepts sanitized reports, IDs, hashes, and screenshots only. Follow
  `release-evidence/README.md` and [credential-incident-response.md](credential-incident-response.md).

## Environment and rollback boundaries

Development, preview, and production need distinct Supabase projects/data, Cloudflare Worker names
and secrets, EAS environments/channels, Sentry environment tags, test accounts, and rate-limit
namespaces. Development and preview contain deliberate `.invalid` Supabase placeholders and fail
closed until their isolated projects are supplied; tracked defaults never target production.

Rollback is explicit and component-specific:

- empty `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL` sends allowlisted mobile calls directly to the compatible
  Supabase origin; it does not enable legacy read routes;
- restore a previous Worker deployment independently;
- move Supabase origin verification from `enforce` to `observe` under the approved compatibility
  plan; clear the gateway and drain Worker traffic before `off` or a prior compatible Function is
  restored; migrations remain forward-only;
- use the previous/embedded EAS update procedure in [ota-rollback-runbook.md](ota-rollback-runbook.md);
- never reset production DB or treat KV/cache as recoverable source data.

Exact provider actions, owners, verification commands, rollback, and evidence destinations are in
[MANUAL_STEPS.md](MANUAL_STEPS.md).
