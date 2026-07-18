# AGENTS.md

## Must-follow constraints

- Keep mobile reads projection-first. Do not reintroduce legacy edge/KV reads as a primary path.
- Treat SQL/RPC as the source of truth for read-heavy flows. Compat GET handlers are rollback-only.
- For Supabase changes, add or update migrations in `supabase/migrations` first. Do not hand-edit schema outside migrations.
- Preserve env parity assumptions:
  - mobile defaults `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`
  - server compat reads stay disabled unless an explicit rollback is required

## Validation before finishing

- Run `npm run check`
- For security/release hardening work, also run `npm run security:verify:internal`.
- `npm run release:verify` now requires local `semgrep`, `gitleaks`, `maestro`, and `k6` plus `K6_*` env vars.

## Repo-specific conventions

- `src/mobile` files must stay within the existing 500-line guard.
- The current mobile app roots are `src/mobile/app/app-shell`, `src/mobile/app/data`, `src/mobile/app/features`, `src/mobile/app/platform`, and `src/mobile/app/shared`.
- The primary mobile read/query surfaces live under `src/mobile/app/data`, especially `data/api`, `data/projections`, and `data/query`.
- Transport, config, Supabase, telemetry, and security live under `src/mobile/app/platform`.
- Edge/server behavior that is still rollback-only lives under `supabase/functions/server`; do not make those handlers primary again.

## Important locations

- `src/mobile/app/app-shell`
- `src/mobile/app/data`
- `src/mobile/app/features`
- `src/mobile/app/platform`
- `src/mobile/app/shared`
- `supabase/migrations`
- `supabase/functions/server`

## Change safety rules

- Do not revert projection screens to screen-owned fetch + broad invalidate patterns.
- Do not weaken or bypass the legacy-read gating contract during normal development.
- When changing read models, keep projection response contracts and env-driven cutover behavior compatible unless the task explicitly authorizes breaking them.
- Do not reintroduce mobile legacy edge fallbacks for follow/block/status flows.
- Production auth recovery/password fallback routes must stay unmounted from the server entrypoint.
