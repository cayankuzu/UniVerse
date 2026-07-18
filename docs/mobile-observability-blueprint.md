# UniVerse Mobile Observability Blueprint

This document describes the current mobile observability model.

## 1. Canonical Entry Points

The current observability surface lives under:

- `src/mobile/app/platform/observability/index.ts`
- `src/mobile/app/platform/observability/sentry.ts`
- `src/mobile/app/platform/telemetry`

App bootstrap entry points:

- `src/mobile/main.tsx`
- `src/mobile/app/app-shell/bridges/AppObservabilityBridge.tsx`

Feature code should not bypass these surfaces and talk to raw Sentry wiring directly.

## 2. Current Helper Surface

The shared helper surface exposed from `platform/observability` is:

- `logEvent`
- `logScreenView`
- `logProjectionMetric`
- `logError`
- `startObservedTimer`

This facade is the current truth. There is no `src/mobile/app/lib/observability`.

## 3. Main Metric Families

Current screen and projection metrics include:

- `time_to_first_cached_content`
- `time_to_first_network_patch`
- `time_to_interactive`
- `cache_hit_rate`
- `delta_payload_size`
- `broad_refetch_count`

Current high-signal collection points include:

- `src/mobile/app/data/projections/useProjectionScreen.ts`
- `src/mobile/app/data/query/guards.ts`
- `src/mobile/app/platform/api/core.ts`
- `src/mobile/app/app-shell/startup/AppDataWarmup.tsx`

## 4. Event Categories

Current telemetry categories include:

- `screen`
- `projection`
- `mutation`
- `error`
- `api_request`

These categories are emitted through the telemetry/observability stack, not from ad hoc feature-local helpers.

## 5. Error Handling Contract

`logError(...)` currently does two things:

- records a telemetry event
- captures the exception in Sentry unless explicitly disabled

Current hygiene expectations:

- no secrets in error logs
- no heavy payload dumps
- meta should stay lightweight and sanitized
- screen and scope identifiers should be redacted and bounded

## 6. Operational Coverage

Current observability should make these areas visible:

- projection refresh success and failure
- cache-first behavior regressions
- broad refetch attempts blocked by query guards
- critical mobile mutations and their failure rates
- app startup and warmup behavior

## 7. Validation

Closing checks:

- `npm run check`
- `npm run security:verify:internal`

Useful test areas:

- projection metric emission
- cache-first loading behavior
- guarded invalidation behavior
- transport error normalization

## 8. Guardrail

Observability is part of the architecture, not a side concern.

If metrics stop reflecting projection-first behavior, cache hits, guarded invalidation, or startup health, the mobile architecture truth is no longer reliable.
