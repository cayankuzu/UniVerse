# UniVerse selective edge gateway

This Worker is a narrow security gateway in front of a small set of existing Supabase Edge
Function routes. Supabase Auth, PostgreSQL/RLS, Realtime, projections/RPCs and private Storage
remain the source-of-truth paths. It is not a general API proxy.

## Route boundary

The gateway accepts only the routes in `src/routePolicy.ts`. Everything else returns `404`; a
matched path with the wrong method returns `405`. Responses are currently always
`Cache-Control: private, no-store`. No KV, D1, R2, Queue, Durable Object or shared cache is used.

Mobile cutover is explicit through `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL`. When that value is
empty, all calls remain on the current Supabase base URL. Even when configured, the central
mobile router sends only the matching method/path pairs through this Worker.

## Local verification

```powershell
npm ci
npm run types:check
npm run typecheck
npm test
npm run deploy:dry-run
```

The test suite runs in the Cloudflare Workers runtime and covers route/method/body/query
allowlists, CORS, no-store behavior, rate-limit denial, JWT verification, retry bounds, fresh
per-attempt HMAC v2 signing, opaque network-key binding and safe header forwarding.

## Required configuration

Non-secret variables are declared per environment in `wrangler.jsonc`. Development and preview
deliberately use `.invalid` upstream placeholders, so neither can accidentally reach production.
Local development must override `SUPABASE_URL`, `JWT_ISSUER`, and `ORIGIN_BASE_URL` with one
isolated non-production Supabase project (for example with repeated `wrangler dev --var` flags).
Preview remains fail closed until its isolated project values are supplied through deployment
configuration.

Required Cloudflare secrets, independently provisioned for preview and production:

- `SUPABASE_PUBLISHABLE_KEY`
- `ORIGIN_HMAC_SECRET` (at least 32 bytes; also provisioned as a Supabase project secret)
- `RATE_LIMIT_SALT` (at least 32 bytes and unique per environment)

Never commit `.dev.vars`, `.env*`, provider tokens or secret values. `ALLOWED_ORIGINS` is an exact
comma-separated origin list; native clients may legitimately omit `Origin`.

## Deployment order

1. Deploy the replay-protection migration and Supabase verifier with origin enforcement `off`.
2. Provision preview secrets/config and deploy the preview Worker.
3. Set origin verification to `observe`, exercise all selected routes and inspect sanitized logs.
   Confirm that signed calls use distinct origin network budgets for distinct test networks and
   that a retried GET presents a new nonce/signature while retaining the same opaque network key.
4. Set the isolated preview origin in `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL` and the distinct
   production origin in `EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL` as its deny target, then
   complete the existing-flow smoke matrix. Missing, non-HTTPS, non-origin, or equal values fail
   closed. Production cutover requires `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL` to exactly match that
   declared production origin.
5. Upload a production Worker version, then use the protected production workflow for
   `5% -> 25% -> 50% -> 100%` traffic steps.
6. After old-client usage and rollback evidence are attached, change origin verification from
   `observe` to `enforce` for the selected routes.

Rollback is independent: restore the previous Worker deployment, move origin verification to
`observe`, and publish an app config/update with an empty gateway URL to return mobile requests
directly to the compatible Supabase origin. Drain gateway traffic before selecting `off` or
restoring the prior compatible Function. Do not enable origin enforcement until the compatibility
window is intentionally closed.

See `docs/cloudflare-architecture.md`, `docs/cloudflare-route-matrix.md`,
`docs/cloudflare-threat-model.md`, `docs/cache-and-rate-limit-policy.md` and
`docs/MANUAL_STEPS.md`.
