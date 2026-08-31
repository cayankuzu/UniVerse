# Cache and rate-limit policy

Updated: 2026-08-30

## Cache decision

The current selective gateway has no shared cache. Every response, including `/health`, is returned
with `Cache-Control: private, no-store, max-age=0` and `Pragma: no-cache`; origin cookies and origin
cache headers are stripped.

This is intentional. Auth availability, registration, reports and upload-session state are either
sensitive, user-specific, mutable or abuse-sensitive. Feed, profile, attendance and block-aware
projections are excluded from the Worker entirely. Therefore there is no demonstrated response that
meets `PUBLIC_CACHEABLE` requirements today.

A future cache change requires all of the following in one reviewed change: public/user-independent
response proof; auth/cookie absence; normalized query/key allowlist; bounded TTL; response schema;
4xx/429/5xx exclusion; user-A/user-B/blocked-pair leakage tests; purge/version strategy; measured
latency/cost benefit; and rollback. KV is not an acceptable shortcut or source of truth.

## Worker rate limits

The Worker uses environment-specific Cloudflare Rate Limiting bindings. The configured initial
engineering ceilings are safeguards, not product/business quotas:

| Policy |    Current binding limit | Routes                                |
| ------ | -----------------------: | ------------------------------------- |
| auth   | 20 requests / 60 seconds | availability and registration         |
| report | 12 requests / 60 seconds | report creation                       |
| upload | 60 requests / 60 seconds | upload-session create/finalize/cancel |

Keys are SHA-256-derived from a secret environment salt plus environment, route, verified subject
or normalized anonymous identifier, and network signal. Raw e-mail, username, user ID or IP is not
placed in the limiter key or log.

The Supabase layer retains its existing user/value/network budgets and every exact business
invariant. For signed Worker requests, the Worker forwards a separate salted 43-character network
key covered by HMAC v2. Supabase trusts it only after signature and replay verification, then uses it
as a request-local rate-limit subject; this prevents all clients from collapsing into one Worker
egress-IP bucket without forwarding raw IP. Unsigned/direct requests continue to use the origin's
normal transport-address resolution. Cloudflare denial returns `429` with `Retry-After: 60`. Limits
must be adjusted only with observed preview/production traffic, false-positive evidence and a
recorded rollback; no invented SLO or capacity claim is made here.

## WAF and platform protections

WAF/DDoS rules are zone/account state and are not asserted as deployed by this repository. The
manual activation plan restricts methods/body size and known paths before enabling managed/bot/ASN
rules. Any rule that can block native clients must start in log/challenge-safe preview mode and have
a tested disable path. The application must never depend on CORS or WAF as its authorization layer.

## Monitoring and rollback

Correlate Worker outcome codes and `cf-ray` with the bounded request ID and Supabase request/audit
events. Gate each rollout step on attached baseline comparisons for origin error ratio, auth
failure, 429 rate and latency. Rollback is a previous Worker version plus, when needed, an app
configuration/update with an empty `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL`. Move origin verification
to `observe` for compatibility, then drain gateway traffic before selecting `off` or restoring the
prior compatible Function.
