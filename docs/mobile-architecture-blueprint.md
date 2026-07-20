# UniVerse Mobile Architecture Blueprint

This document describes the current mobile architecture as it exists in the repo today.

## Real Mobile Roots

The live mobile app is organized under these roots only:

- `src/mobile/app/app-shell`
- `src/mobile/app/data`
- `src/mobile/app/features`
- `src/mobile/app/platform`
- `src/mobile/app/shared`

The deleted legacy roots below are migration history and must not be reintroduced:

- `src/mobile/app/core`
- `src/mobile/app/lib`
- `src/mobile/app/infra`
- `src/mobile/app/navigation`
- `src/mobile/app/types`
- `src/mobile/app/i18n`

## Entry And Runtime Composition

Entry flow:

- `src/mobile/main.tsx`
- `src/mobile/app/App.tsx`

App composition:

- `src/mobile/app/app-shell/providers/AppProviders.tsx`
- `src/mobile/app/app-shell/providers/AppBootstrapProviders.tsx`
- `src/mobile/app/app-shell/providers/AppRuntimeProviders.tsx`
- `src/mobile/app/app-shell/providers/AppErrorBoundary.tsx`

Runtime ownership:

- auth runtime: `src/mobile/app/app-shell/auth`
- onboarding runtime: `src/mobile/app/app-shell/onboarding`
- startup and warmup: `src/mobile/app/app-shell/startup`
- shell bridges: `src/mobile/app/app-shell/bridges`
- queue composition: `src/mobile/app/app-shell/queues`

There is no `src/mobile/app/app-shell/context` folder.
Runtime contexts live beside the shell concerns that own them.

## Navigation

Navigation is shell-owned and lives under `src/mobile/app/app-shell/navigation`.

Primary files:

- `RootNavigator.tsx`
- `rootNavigationScreens.tsx`
- `rootNavigation.linking.ts`
- `useRootNavigationController.ts`
- `navigators/AuthNavigator.tsx`
- `navigators/MainTabsNavigator.tsx`
- `navigators/stacks/*`

There is no top-level `src/mobile/app/navigation` folder.

## Data Layer

The shared mobile data layer lives under `src/mobile/app/data`.

Key areas:

- `data/auth`
- `data/content`
- `data/notifications`
- `data/social`
- `data/projections`
- `data/query`
- `data/compat`
- `data/mutations`
- `data/queues`
- `data/security`

Current read policy:

- mobile reads stay projection-first
- SQL/RPC-backed reads are the source of truth for read-heavy flows
- compat GET reads stay rollback-only

Canonical projection surfaces:

- `data/projections/screen/useProjectionScreen.ts`
- `data/projections/projections.ts`
- `data/projections/projectionFreshness.ts`
- `data/projections/sync/syncOrchestrator.ts`
- `data/query/queryClient.ts`
- `data/query/guards.ts`

Startup policy:

- restore local query/home/media caches in parallel
- never gate the splash screen on a network request
- warm only the first-fold home projection and notification badge
- prefetch profile/search data only after explicit touch intent
- keep notification presence event-driven; fixed polling is prohibited

## Features

Feature ownership lives under `src/mobile/app/features`.

Live modules:

- `auth`
- `content`
- `events`
- `home`
- `notifications`
- `profile`
- `search`
- `settings`

Current feature vocabulary:

- `ui`
- `application`
- `domain`
- `data`
- `public`

Rules:

- `ui` is for screens and presentation components
- `application` is for orchestration hooks and screen controllers
- `domain` is for feature-local pure rules and transforms
- `data` is for repositories, adapters, queues, and cache-facing helpers
- cross-feature access must go through an explicit public contract
- `features/content` is the only approved shared feature surface

Feature barrels are optional.
Only keep them when they are real public APIs.

## Platform

Infrastructure lives under `src/mobile/app/platform`.

Current subareas:

- `platform/api`
- `platform/config`
- `platform/logging`
- `platform/media`
- `platform/observability`
- `platform/security`
- `platform/storage`
- `platform/supabase`
- `platform/telemetry`

Platform must stay acyclic and must not import `data`, `features`, or `app-shell`.

## Shared

Reusable app-wide code lives under `src/mobile/app/shared`.

Current shared areas:

- `shared/components`
- `shared/theme`
- `shared/layout`
- `shared/catalog`
- `shared/i18n`
- `shared/hooks`
- `shared/utils`
- `shared/fixtures`

`shared` is for reusable app-wide code, not feature workflows.

## Non-Negotiable Rules

- keep mobile reads projection-first
- keep compat reads rollback-only
- keep Supabase schema changes migration-first
- do not revive deleted roots
- keep shell ownership in `app-shell`
- keep infra ownership in `platform`
- keep reusable app-wide code in `shared`
- keep feature workflows inside `features`
- keep cross-feature imports behind explicit public contracts
- keep wildcard re-exports out of feature contracts

## Validation

Architecture changes must keep these healthy:

- `npm run check`
- `npm run security:verify:internal`
