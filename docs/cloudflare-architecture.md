# Selective Cloudflare architecture

Updated: 2026-08-30

## Decision

Cloudflare is used only as a security and traffic-control layer for existing high-risk HTTP
operations. It does not replace Supabase and it does not become a second data store.

```text
Mobile
├─ Supabase Auth
├─ PostgreSQL + RLS + projection/RPC reads       (direct)
├─ Realtime                                      (direct)
├─ private Storage and signed media              (direct)
└─ central API transport
   ├─ all ordinary API routes                    -> Supabase Edge Function
   └─ explicit method/path allowlist, when enabled
      -> Cloudflare Worker/WAF/rate-limit binding
         -> signed request -> same Supabase Edge Function routes
```

`src/mobile/app/platform/api/core.routing.ts` is the single mobile cutover point. An empty
`EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL` is the rollback/default state. It never redirects feed,
projection, follow/block/status, Realtime or private-media traffic through Cloudflare.

## Request path

1. The mobile transport selects the base URL from the exact method/path matrix.
2. The Worker validates configuration, route, method, query, origin, body size/content type and
   schema before any upstream call.
3. Protected routes require a fully verified Supabase JWT. ES256/RS256 tokens use Supabase JWKS;
   legacy HS256 tokens are validated by Supabase Auth `/auth/v1/user` rather than by distributing
   the legacy JWT secret.
4. The Worker derives a salted rate-limit key from environment, route, verified subject or
   normalized anonymous identifier, and network signal. It separately derives an opaque salted
   client-network key for the origin; raw identifiers are neither forwarded nor stored in a key.
5. The Worker forwards the user bearer token and publishable key so the origin's user/RLS checks
   remain authoritative.
6. HMAC v2 signs timestamp, a per-attempt nonce, method, canonical path, opaque client-network key
   and SHA-256 body hash with a secret shared only by Cloudflare and the Supabase function
   environment. A bounded GET retry receives a fresh nonce and signature.
7. Supabase verifies the signature and records the nonce before handling the selected route. Only
   after verification does it use the opaque network key as the request-local subject for existing
   origin abuse budgets, avoiding a single shared Cloudflare egress-IP bucket.
8. The response is reduced to an allowlist of headers, cookies are removed, and private no-store
   is enforced.

## Products deliberately not used

| Product                | Decision      | Reason                                                                                                      |
| ---------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| Workers                | Used narrowly | Schema/JWT/origin protection and request correlation for the selected routes.                               |
| Workers Rate Limiting  | Used          | Distributed abuse budget; no process-local `Map`. Business quotas remain transactional in Supabase.         |
| Cache/KV               | Not used      | No selected response has yet been proven public, user-independent and block/privacy independent.            |
| Queues/Durable Objects | Not used      | Existing Supabase outbox/cleanup state is sufficient; no measured reliability gap justifies another system. |
| R2/Images              | Not used      | Private media remains in Supabase Storage; no measured public-thumbnail benefit is attached.                |
| Pages                  | Not used      | No existing static product surface needs migration. New pages are prohibited by feature freeze.             |

## Environment isolation

Development, preview and production have distinct Worker names, limiter namespace IDs, secrets,
upstreams and sampling. Production disables `workers.dev` and preview URLs. Preview contains
fail-closed `.invalid` upstreams until the real isolated project is entered. A stable custom
`api.*` hostname is intentionally a manual DNS/zone decision because the repository contains no
verified root-domain ownership evidence.

## Rollout and rollback

The cutover order is `off -> observe -> preview -> Worker 5/25/50/100 -> origin enforce`, with a
compatibility window for installed binaries. Each percentage change is a separate protected
production approval. Health, auth failures, rate limits, origin error ratio and latency must be
compared to an attached baseline; the repository does not invent numeric SLOs.

Rollback can independently restore a prior Worker version or return the Supabase verifier to
`observe`. Clear the mobile gateway URL and drain Worker traffic before selecting `off` or restoring
a prior compatible Function; do not leave the signed gateway active while origin authentication is
disabled. Database migrations are forward-only; replay rows expire and do not become product data.

## Observability and data minimization

Worker logs contain only environment, route ID, method, status, outcome code, duration and bounded
request ID. `cf-ray` is returned as a bounded response correlation header. Request/response bodies,
query values, bearer tokens, e-mail, user IDs and raw IP addresses are not logged. Supabase remains
the audit source for authenticated product operations.
