# UniVerse Mobile Data Loading Blueprint

This document describes the current cache-first mobile loading model.

## 1. Core Principle

Target behavior:

- screens should open from cache when possible
- network should refresh quietly instead of resetting the screen

Current implementation combines:

- React Query server state
- projection snapshots
- delta sync
- optimistic patching where appropriate

## 2. Current Projection-First Loading Path

Read-heavy mobile surfaces use projection/RPC-backed reads first.

Current key paths:

- `src/mobile/app/data/projections/projections.ts`
- `src/mobile/app/data/projections/projections.request.ts`
- `src/mobile/app/data/projections/projections.api.helpers.ts`
- `src/mobile/app/data/projections/projectionMerge.ts`
- `src/mobile/app/data/projections/useProjectionScreen.ts`

Rollback-only edge reads are isolated under:

- `src/mobile/app/data/compat/legacyRollbackEdgeReads.ts`

## 3. Query And Cache Surfaces

The current query/cache setup lives under:

- `src/mobile/app/data/query/queryClient.ts`
- `src/mobile/app/data/query/persist.ts`
- `src/mobile/app/data/query/options.ts`
- `src/mobile/app/data/query/guards.ts`

Important rule:

- guarded projection scopes must not fall back to broad immediate invalidation

## 4. Projection Envelope Reality

The shared projection model currently revolves around:

- `items`
- `updatedItems`
- `deletedIds`
- `nextCursor`
- `serverTime`
- `deltaToken`

These fields are merged into screen projection state rather than forcing full-screen resets.

## 5. `useProjectionScreen` Standard Behavior

`src/mobile/app/data/projections/useProjectionScreen.ts` is the current shared screen-loading abstraction.

It is responsible for:

- using cached screen state first
- showing an initial skeleton only when no usable snapshot exists
- refreshing without clearing the list
- supporting delta and append modes
- coordinating freshness and telemetry hooks

Related supporting modules:

- `src/mobile/app/data/projections/projectionFreshness.ts`
- `src/mobile/app/data/projections/projectionPolicies.ts`
- `src/mobile/app/data/projections/projectionScreenTelemetry.ts`
- `src/mobile/app/data/projections/useScreenRefresh.ts`
- `src/mobile/app/data/projections/useScreenSync.ts`
- `src/mobile/app/data/projections/syncOrchestrator.ts`

## 6. Freshness And Sync Rules

Current freshness decisions are made per projection scope.

Important triggers:

- first open
- screen focus
- foreground return
- pull-to-refresh
- realtime stale signals

Current rule set:

- prefer delta sync over full reload
- avoid emptying the screen during refresh
- use replace mode only when the cache contract requires it

## 7. Mutation Follow-Up Rules

Current intended post-mutation flow:

1. optimistic patch when supported
2. entity/projection patch or stale mark
3. quiet follow-up sync when needed

Forbidden behavior for normal flows:

- screen-owned broad invalidation
- full list reset after every mutation

## 8. Prefetch And Warmup

Current prefetch and warmup surfaces include:

- `src/mobile/app/data/projections/prefetch/intentPrefetch.ts`
- `src/mobile/app/data/projections/prefetch/prefetchProjection.ts`
- `src/mobile/app/data/projections/prefetch/nextStepPrefetch.ts`
- `src/mobile/app/data/projections/warmupPreferences.ts`
- `src/mobile/app/app-shell/startup/AppDataWarmup.tsx`

Prefetch is used to improve first paint for likely next navigation targets.

## 9. Realtime And Cache Updates

Realtime-driven cache updates currently flow through:

- `src/mobile/app/app-shell/bridges/ProjectionRealtimeBridge.tsx`
- `src/mobile/app/data/projections/projectionRealtime.ts`

The current strategy is hybrid:

- deterministic changes may patch the cache directly
- non-deterministic changes may mark a scope stale and schedule sync

## 10. Measurement

Current loading metrics are emitted through the observability layer:

- `time_to_first_cached_content`
- `time_to_first_network_patch`
- `time_to_interactive`
- `cache_hit_rate`
- `delta_payload_size`
- `broad_refetch_count`

## 11. Validation

Closing checks:

- `npm run check`
- `npm run security:verify:internal`

Acceptance criteria for major list screens:

- if a screen has already loaded successfully once, the next open should prefer last-known content
- refresh should stay in the background where possible
- full-screen empty loading should not replace good cached content during normal refresh
