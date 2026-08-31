# Cloudflare route matrix

Updated: 2026-08-30

Default for every unlisted route is direct Supabase. The Worker returns `404` for an unlisted path
and `405` for a listed path with the wrong method. All responses are private/no-store.

| ID                                | Method/path                             | Auth                                       | Max body | Why at edge                                                | Retry                         | Origin/source of truth                           | Rollback                                        |
| --------------------------------- | --------------------------------------- | ------------------------------------------ | -------: | ---------------------------------------------------------- | ----------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `health`                          | `GET /health`                           | none                                       |        0 | Secret-free Worker/config health                           | none                          | Worker-local; no upstream                        | Restore prior Worker or disable gateway URL     |
| `auth.check-username`             | `GET /auth/check-username/:username`    | none                                       |        0 | Validate identifier and add distributed abuse budget       | one retry only on 502/503/504 | Existing Supabase availability route             | Empty gateway URL                               |
| `auth.check-email`                | `GET /auth/check-email?email=...`       | none                                       |        0 | Exact query/schema and distributed abuse budget            | one retry only on 502/503/504 | Existing Supabase availability route             | Empty gateway URL                               |
| `auth.register-direct`            | `POST /auth/register-direct`            | none; registration nonce checked at origin |   16 KiB | Body allowlist, mass-assignment stripping and abuse budget | never                         | Supabase Auth/profile persistence                | Empty gateway URL; origin compatibility remains |
| `auth.register`                   | `POST /auth/register`                   | verified user JWT                          |   16 KiB | JWT, schema and abuse controls                             | never                         | Supabase Auth/profile persistence and RLS checks | Empty gateway URL                               |
| `reports.create`                  | `POST /reports`                         | verified user JWT                          |    4 KiB | Target schema, rate limit and correlation                  | never                         | Supabase moderation/report transaction           | Empty gateway URL                               |
| `storage.upload-session.create`   | `POST /storage/upload-session/create`   | verified user JWT                          |   16 KiB | Bounds upload metadata and session abuse                   | never                         | Supabase upload-session tables/private Storage   | Empty gateway URL                               |
| `storage.upload-session.finalize` | `POST /storage/upload-session/finalize` | verified user JWT                          |    1 KiB | Validates session identifier and limits finalize races     | never                         | Supabase upload state machine/private Storage    | Empty gateway URL                               |
| `storage.upload-session.cancel`   | `POST /storage/upload-session/cancel`   | verified user JWT                          |    1 KiB | Validates session identifier and limits cancel races       | never                         | Supabase upload state machine/cleanup outbox     | Empty gateway URL                               |

## Explicit exclusions

- Projection/RPC reads, feed, search, profile, event/album reads and notification reads remain
  direct and projection-first.
- Follow, block and status flows never gain a legacy Edge fallback.
- Actual media bytes, signed URLs, upload ticket/confirm, Realtime and Supabase Auth calls remain
  direct.
- No selected route is `PUBLIC_CACHEABLE`; public cache may be introduced only after a new leakage
  proof, response-contract test, invalidation design and explicit review.

## Contract rules

- Query parameters are rejected unless the route policy explicitly names them.
- JSON schemas strip unknown keys before forwarding.
- Mutations are not automatically retried. The existing origin remains responsible for business
  idempotency/transactions.
- A protected request retains the same bearer token at origin; Cloudflare never substitutes a
  service-role credential.
- Native requests without `Origin` are permitted. Browser origins must match `ALLOWED_ORIGINS`
  exactly; CORS is not treated as authentication.
