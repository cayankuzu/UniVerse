# Cloudflare gateway threat model

Updated: 2026-08-30

## Assets and trust boundaries

Protected assets are Supabase user sessions, profile/report/upload metadata, private Storage state,
origin availability, limiter capacity and the two server-only secrets. Boundaries are mobile to
Cloudflare, browser origin to Cloudflare, Cloudflare to Supabase Edge Function, and the Edge
Function to Auth/PostgreSQL/Storage.

The mobile bundle is untrusted. `SUPABASE_PUBLISHABLE_KEY` and the gateway URL are public by design.
`ORIGIN_HMAC_SECRET`, `RATE_LIMIT_SALT`, service-role keys and provider API tokens must never enter
the bundle or logs.

## Threats and controls

| Threat                                      | Control                                                                                                  | Verification                                        | Residual/manual work                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Route/method smuggling                      | Exact path regex, method allowlist, canonical URL construction; no open proxy                            | Worker route/method tests                           | Cloudflare zone/WAF rules must be reviewed after DNS activation       |
| Oversized/malformed or mass-assignment body | Content-Length and streamed byte limit, JSON content type, Zod allowlist normalization                   | body/schema tests                                   | Origin schemas stay authoritative and must remain contract-compatible |
| Forged/expired JWT                          | Algorithm allowlist; JWKS signature or Supabase Auth validation; issuer/audience/exp/nbf/sub/role checks | asymmetric, legacy, audience and time tests         | Supabase signing-key rotation rehearsal                               |
| Enumeration/credential abuse                | Distributed binding plus existing origin budgets keyed by an HMAC-bound opaque client-network subject    | limiter denial, hashed-key and origin trust tests   | Tune only from preview/production evidence; configure WAF manually    |
| Cross-user or block/privacy leakage         | No shared cache; same user bearer token reaches origin/RLS                                               | no-store/cookie stripping and route exclusion tests | Staging user-A/user-B/blocked-pair adversarial run                    |
| Origin bypass/Worker impersonation          | HMAC v2 over version, timestamp, nonce, method, path, opaque network key and body hash                   | deterministic signing plus origin verifier tests    | Staged observe/enforce cutover after old-client measurement           |
| Replay                                      | Short timestamp window and per-attempt single-use nonce stored in an RLS-protected Supabase table        | verifier/replay and retry-nonce tests               | Expired-row cleanup and production collision monitoring               |
| SSRF/upstream substitution                  | Environment URL parsing, HTTPS, same Supabase origin, `.invalid` rejection                               | fail-closed config test                             | Protected environment approval for config changes                     |
| Retry duplicate mutation                    | No mutation retry; only allowlisted GET gets one bounded retry with a fresh signed nonce                 | retry-count and per-attempt-signature test          | Business idempotency remains required in PostgreSQL/RPC               |
| CORS misconception                          | Exact browser allowlist; native no-Origin accepted; JWT still required by protected routes               | CORS/native tests                                   | Populate real browser origins only if an existing client needs them   |
| Secret/PII leakage                          | Structured field allowlist; no raw identifier/token/body/query/IP logs; cookie stripping                 | log spy and response-header tests                   | Provider log sampling/retention review                                |
| Misconfiguration or weak secret             | Typed required secrets, minimum lengths, HTTPS/upstream consistency, preview placeholder rejection       | config/type generation tests                        | Secret creation/rotation is a manual provider action                  |
| Supply-chain compromise                     | Exact package lock, pinned Worker dependencies, typecheck/runtime tests and CI dry-run                   | `npm ci`, audit, Worker checks                      | Cloudflare token must be minimum-scope and environment-separated      |

## Fail-safe behavior

Invalid gateway configuration returns a generic `503`; invalid input fails before origin; unknown
routes fail closed. Mobile rollback is explicit and does not silently retry a failed mutation on the
direct origin. Supabase origin verification defaults to `off` for compatibility, then moves through
`observe` before `enforce`; that rollout state is an operational control, not an authentication
bypass to leave enabled indefinitely.

HMAC v2 is the first repository implementation of Worker-to-origin signing; no deployed v1 contract
is assumed. A rollback restores the previous no-gateway/compatible Function path, not an invented v1
signature. Origin mode may reach `off` only after gateway traffic is cleared and drained.

## Accepted residual risks

- Rate Limiting binding semantics are an abuse-control layer, not an exact product quota.
- A rooted/compromised device can use public endpoints and extract its own bearer token; RLS and
  origin authorization remain mandatory.
- Production WAF, DNS, dashboard alerts, provider logs and real traffic behavior cannot be proven
  from the repository alone and keep the release `NO-GO` until same-SHA evidence is attached.
