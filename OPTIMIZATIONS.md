# OPTIMIZATIONS.md

## 1) Optimization Summary

- Current optimization health is better but not complete. Release gates are stricter, storage bucket initialization is memoized, and mobile social flows no longer spend network work on legacy edge fallbacks.
- Top 3 highest-impact improvements:
  - Batch `albums.ts` and `profiles.ts` enrichment work to remove N+1 KV/profile/block lookups.
  - Continue splitting oversized server route files into validator/service/repository modules.
  - Move remaining rollback-only server reads out of the production entrypoint or isolate them into compat-only modules.
- Biggest risk if no changes are made: the app will stay correct under moderate load, but server-side latency and maintenance cost will keep increasing because large route files still combine validation, orchestration, KV access, and response shaping.

## 2) Findings (Prioritized)

- **Server album/profile enrichment still performs repeated per-item reads**
- **Category** DB / I/O / Algorithm
- **Severity** High
- **Impact** Lower latency, lower KV/DB fanout, lower cost
- **Evidence** `supabase/functions/server/routes/albums.ts` and `supabase/functions/server/routes/profiles.ts` still call block/profile/likes/comments lookups inside loops.
- **Why it’s inefficient** Per-item reads create N+1 behavior and serialized waits in the hottest feed/profile paths.
- **Recommended fix** Preload block pairs, profile maps, like counts, and comment counts in batches before enrichment.
- **Tradeoffs / Risks** Requires careful parity testing so visibility and lock-state logic stay correct.
- **Expected impact estimate** High on p95 latency for event album/profile surfaces.
- **Removal Safety** Needs Verification
- **Reuse Scope** service-wide

- **Legacy compat code still inflates the server maintenance surface**
- **Category** Reliability / Cost / Reuse Opportunity
- **Severity** High
- **Impact** Faster audits, safer changes, smaller accidental production surface
- **Evidence** `auth.ts`, `albums.ts`, `index.ts`, and `events.ts` remain large and still contain rollback-oriented logic even when production behavior is narrower.
- **Why it’s inefficient** Engineers and profilers still pay the cognitive cost of code that should no longer be a primary path.
- **Recommended fix** Extract compat-only handlers into separate modules and stop mounting them in production entrypoints.
- **Tradeoffs / Risks** Rollback becomes artifact/deploy-based instead of code-path-based.
- **Expected impact estimate** High on maintainability, medium on reliability.
- **Removal Safety** Needs Verification
- **Reuse Scope** service-wide

- **Release verification still depends on externally installed tools**
- **Category** Build / Reliability
- **Severity** Medium
- **Impact** More deterministic release validation
- **Evidence** `release:verify` now checks Semgrep/Gitleaks/Maestro/k6 presence, but local machines can still fail early if the toolchain is incomplete.
- **Why it’s inefficient** Late discovery of missing tools wastes release time and obscures whether failures come from code or environment.
- **Recommended fix** Standardize the toolchain in CI and developer onboarding; prefer CI as the source of truth for full release verification.
- **Tradeoffs / Risks** Slightly heavier CI setup.
- **Expected impact estimate** Medium
- **Removal Safety** Safe
- **Reuse Scope** service-wide

## 3) Quick Wins (Do First)

- Batch profile/block/likes/comments reads in `albums.ts` and `profiles.ts`.
- Extract or continue consolidating the shared social mutation/readback helper in `src/mobile/app/data/api`.
- Move auth recovery route registration into a dedicated compat module so `auth.ts` shrinks further.

## 4) Deeper Optimizations (Do Next)

- Replace remaining loop-driven compat hydration with SQL/RPC summary reads.
- Split `albums.ts`, `events.ts`, and `index.ts` into validator/service/repository/mapper layers.
- Add CI-backed performance baselines for projection RPC latency and authenticated cold-open timings.

## 5) Validation Plan

- Compare before/after p95 for album event/profile endpoints and projection RPCs.
- Track KV query count and total edge request duration for enriched album/profile responses.
- Keep `npm run check`, `npm run security:verify:internal`, Maestro smoke, and k6 smoke/sustained as baseline verification.
- Confirm no mobile telemetry references legacy edge follow/block/status endpoints after the social API cleanup.

## 6) Optimized Code / Patch (when possible)

```ts
// Direction: batch enrichment inputs before mapping album rows.
const profileIds = Array.from(new Set(photoRows.map((row) => row.user_id).filter(Boolean)));
const profileMap = await loadProfileMap(profileIds);
const commentCounts = await loadAlbumCommentCounts(photoIds);
const likeState = await loadAlbumLikeState(photoIds, viewerId);

return photoRows.map((row) =>
  mapAlbumRow({
    commentCounts,
    likeState,
    profile: profileMap.get(row.user_id),
    row,
  }),
);
```
