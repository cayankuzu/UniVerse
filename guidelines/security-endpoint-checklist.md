# Security Endpoint Checklist

Use this checklist for every new edge endpoint, RPC wrapper, or storage-facing server path.

## Request Contract

- Define `params`, `query`, and `body` schemas before writing handler logic.
- Clamp all free-text input with explicit min/max lengths.
- Use enums or whitelists for `type`, `sort`, `filter`, and state transitions.
- Enforce explicit upper bounds for `limit`, pagination windows, and collection sizes.
- Reject malformed input with short `400` responses. Do not leak stack traces or SQL details.

## Auth And Authorization

- Declare the client `authMode` explicitly at the callsite.
- Default to authenticated access unless the endpoint is intentionally public.
- Use `auth.uid()` or equivalent trusted identity source for row ownership checks.
- Keep rollback-only recovery routes env-gated and out of the default production mount.
- If storage access is involved, gate signed URL creation behind an entitlement check instead of path existence.

## Rate Limiting

- Choose an IP budget and a user budget for any route that can be abused.
- Apply stricter limits to auth, search, reports, upload, and signed URL routes.
- Return short `429` responses without internal details.

## Data Access

- Prefer SQL/RPC and projection-first reads. Do not make compat KV handlers primary again.
- Keep RLS enabled on every table touched by the feature.
- If a new read path needs privileged access, add a security-definer RPC or server-side authorization check instead of widening direct table or storage access.
- For storage paths, generate signed URLs only after an entitlement check.

## Logging And Privacy

- Use the shared redaction utilities before logging payloads, headers, URLs, or provider errors.
- Never log full tokens, passwords, reset links, signed URL secrets, or raw authorization headers.
- Mask email-bearing payloads and cloud signature params such as `signature`, `sig`, and `x-amz-signature`.
- Keep UI error messages short, Turkish, and non-sensitive.

## Secrets And Release Hygiene

- Never commit `.env` files or private keys. Treat `.env.*` as local-only unless an explicit example file is intended.
- If a historical secret leak is found, rotate the live credential first and plan history cleanup separately.
- Do not weaken `security:verify`, `security:verify:internal`, or `release:verify` to get a release out.

## Validation Before Merge

- `npm run check`
- `npm run security:verify:internal`
- Run the relevant SQL validation scripts when database policy or visibility logic changes.
- Run `npm run security:sast` and `npm run security:secrets` in a prepared environment for release-sensitive changes.
- For release-sensitive changes, verify the release workflow still runs `npm run release:verify` and the SQL validation pack.
