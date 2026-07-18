# Mobile Architecture

This document is the current architecture truth for `src/mobile`.

## Current Top-Level Structure

The mobile app is organized under five real roots:

- `src/mobile/app/app-shell`
  - app composition, providers, startup bridges, queues, and navigation
- `src/mobile/app/data`
  - projection/query infrastructure, shared social graph, security state cleanup, compat read boundaries, shared cache policy
  - `data/auth` is the canonical shared auth surface used by shell runtime and feature data modules
  - `data/notifications` is the canonical shared notification read/prefetch/push surface
  - `data/content` is the canonical shared content read surface used by home, profile, search, and projection fallbacks
  - `data/social` owns social graph operations (follow, block, relationship status)
  - `data/projections` owns projection cache, sync orchestration, prefetch, and shared projection helpers
  - `data/security` owns sensitive client state cleanup
- `src/mobile/app/features`
  - feature-owned screens, hooks, repositories, API adapters, and feature logic
  - each feature owns its own `data/` folder for API adapters and projection APIs
  - `features/content-cards` is the single explicitly blessed shared product UI module for interactive event/album content cards consumed across multiple surfaces
  - feature public contracts use narrow `public/*` modules; broad `public/index.ts` barrels are deleted on purpose
- `src/mobile/app/platform`
  - infrastructure such as config, Supabase, transport (split into auth/headers/pool modules), observability, telemetry, storage, logging, and security
  - `platform/api/contracts.ts` is transport/storage-only; app-facing contracts live under `data/contracts`
  - `platform` never imports from `data`, `features`, or `app-shell`
- `src/mobile/app/shared`
  - reusable generic UI, theme, layout, catalogs, i18n, fixtures, hooks, and pure utilities

The deleted legacy roots below are not part of the current app structure and must not be reintroduced:

- `src/mobile/app/core`
- `src/mobile/app/lib`
- `src/mobile/app/infra`
- `src/mobile/app/navigation`
- `src/mobile/app/types`
- `src/mobile/app/i18n`

## Dependency Rules

Strict one-way dependency flow:

- `shared` -> only `shared` and external libs
- `platform` -> only `platform` and external libs (never `data`, `features`, or `app-shell`)
- `data` -> `platform`, `data`, and external libs
- `features` -> `data`, `platform`, `shared`, and external libs. Cross-feature access is blocked by default; when it is unavoidable it must go through an explicit `public/*` contract. The only approved shared feature contract today is `features/content-cards/public/*`.
- `app-shell` -> `features`, `data`, `platform`, `shared` (composition only)

Direct imports from product features into `features/events` are eliminated. Reusable interactive feed cards now live under `features/content-cards`, and their shared interaction/cache/query dependencies now flow through canonical `data/content` modules instead of feature-to-feature bridges.

## Entry And Runtime Flow

- `src/mobile/main.tsx`
  - initializes one explicit bootstrap pass through `app-shell/bootstrap/appBootstrap.ts`
  - initializes crash reporting through `platform/observability/sentry`
  - exports the wrapped root app component
- `src/mobile/app/App.tsx`
  - owns gesture/safe-area/theme/query provider composition only
  - mounts `AppErrorBoundary`
  - mounts `RootNavigator`

## Navigation Structure

Navigation lives under `src/mobile/app/app-shell/navigation`.

Current flow:

- `RootNavigator.tsx` owns the `NavigationContainer`
- `useRootNavigationController.ts` decides splash/auth/app mode
- `rootNavigationScreens.tsx` composes the root stack around `AuthNavigator`, `MainTabsNavigator`, and global modal screens
- `app-shell/navigation/navigators/AuthNavigator.tsx` owns auth screens
- `app-shell/navigation/navigators/MainTabsNavigator.tsx` owns the tab host
- `app-shell/navigation/navigators/stacks/*` own the per-tab stacks for home, search, and profile
- `MainBottomTabs.tsx` remains the custom shell tab chrome layered above the navigator tree

Navigation barrel uses explicit named exports only.
Unused shell-only facades should be deleted instead of kept as pass-through wrappers. Canonical route helpers stay in `app-shell/navigation`, and projection intent prefetch stays in `data/projections`.

There is no top-level `src/mobile/app/navigation` folder.

## Data And Caching Structure

Projection-first reads are the primary mobile read path.

Key surfaces:

- `src/mobile/app/data/auth`
  - canonical shared auth surface consumed by shell runtime and feature data modules
- `src/mobile/app/data/content`
  - canonical shared content/event/album read surface used by projection and fallback flows
  - canonical shared content interaction/cache/comment-queue surface used by reusable event/album cards
- `src/mobile/app/data/notifications`
  - canonical shared notification query/prefetch/push surface
- `src/mobile/app/data/social`
  - social graph operations: follow, block, relationship status, follow requests
  - owns shared client-side relationship visibility cleanup and blocked-user cache isolation across home/profile/settings surfaces
- `src/mobile/app/data/projections`
  - projection cache state, merge logic, freshness policy, sync orchestration, and prefetch
  - sub-ownership is now explicit:
    - `data/projections/screen/*` for screen orchestration and refresh entrypoints
    - `data/projections/sync/*` for sync orchestration and lifecycle hooks
    - `data/projections/prefetch/*` for intent/viewport/image prefetch
    - `data/projections/policies/*` for freshness and surface policy
  - `screen/useProjectionScreen.ts` is the screen orchestrator only; sync, telemetry, and load-more responsibilities stay in focused helper hooks/modules
  - shared projection helpers and RPC utilities
  - secondary projection fallbacks import canonical content leaf modules directly to keep the data graph acyclic
- `src/mobile/app/data/query`
  - query client setup, persistence, query option helpers, and invalidation guards
- `src/mobile/app/data/security`
  - `clearSensitiveClientState.ts` owns logout/auth-failure state cleanup
- `src/mobile/app/data/compat`
  - rollback-only mobile compat helpers only; mainline app flows must not import this root
- `src/mobile/app/platform/api`
  - low-level request transport split into focused modules: `core.auth.ts`, `core.headers.ts`, `core.requestPool.ts`, and `core.ts`
- `src/mobile/app/platform/supabase`
  - Supabase client setup
- `src/mobile/app/app-shell/startup`
  - warmup orchestration split into focused modules: `appWarmupImages.ts`, `appWarmupIdleTasks.ts`, `appWarmupSeeding.ts`

Runtime defaults keep legacy edge reads disabled:

- `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`
- compat reads stay rollback-only unless an explicit rollback is required

## Shared Components

Shared UI components live under `src/mobile/app/shared/components/`:

- Core primitives: `AppButton`, `AppFlatList`, `AppIconButton`, `AppImage`, `Avatar`, `BackHeader`, etc.
- Form fields: `SelectField` (moved from auth feature), `TextField`, `AppTextField`
- Discovery/content grid cards: `features/content-cards/ui/discovery/`
- Interactive feed cards: `src/mobile/app/features/content-cards/public/*` is the current shared content-card contract and implementation owner for reusable event/album cards. The folder is treated as a shared product UI module, not as an independent product surface.

Onboarding lives under `src/mobile/app/app-shell/onboarding/`:

- Onboarding is now permissions-only.
- `src/mobile/app/app-shell/onboarding/domain/runtime.ts` exposes only the permission prompt contract used by the shell.
- `src/mobile/app/app-shell/onboarding/ui/components/PermissionsScreen.tsx` is the only active onboarding UI.
- `src/mobile/app/app-shell/onboarding/ui/components/TourAnchor.tsx` remains as an inert compatibility wrapper for shared card/header markup; it no longer owns anchor registration or spotlight runtime state.

Barrels use explicit named exports only. Compatibility wrappers should be removed when their remaining tests or consumers are migrated.
Canonical repository tests should live beside canonical repositories, not beside temporary feature wrappers.

## Shared And Cross-Cutting Structure

There are no top-level `config`, `catalog`, `context`, or `i18n` roots. Their current homes are:

- config: `src/mobile/app/platform/config`
- runtime context contracts: `src/mobile/app/app-shell/navigation/TabReselectContext.tsx` and `src/mobile/app/app-shell/navigation/ChromeVisibilityContext.tsx`
- catalog: `src/mobile/app/shared/catalog`
- i18n: `src/mobile/app/shared/i18n`

Cross-cutting concerns:

- observability: `src/mobile/app/platform/observability`
- telemetry: `src/mobile/app/platform/telemetry`
- security: `src/mobile/app/platform/security` (errors, redaction, password policy)
- sensitive state cleanup: `src/mobile/app/data/security` (moved from platform to avoid reverse dependency)
- logging: `src/mobile/app/platform/logging`
- media/storage: `src/mobile/app/platform/media`, `src/mobile/app/platform/storage`
- auth runtime wiring: `src/mobile/app/app-shell/auth/session/useAuthRuntime.ts`
- auth session lifecycle split: `useAuthSessionLifecycle.ts`, `useAuthSessionStateActions.ts`, `useAuthSessionHydration.ts`, `useAuthBootTimeout.ts`
- onboarding runtime wiring: `src/mobile/app/app-shell/onboarding/domain/runtime.ts`, `useOnboardingProviderState.ts`
- blocked-user client isolation wiring: `src/mobile/app/data/social/clientIsolation.ts`, `relationshipCacheIsolation.ts`, `clientIsolationRegistry.ts`

## Feature Module Structure

Features are converging on a consistent four-layer vocabulary:

- `ui` - screens and presentation components only
- `application` - impure orchestration hooks and controllers that coordinate query, navigation, auth, queues, or cache policy
- `domain` - pure helpers, schemas, transforms, and business rules only
- `data` - repositories, API adapters, projection APIs, queue processors, and feature-owned cache helpers

Most features expose `application` alongside `data/domain/ui`. Some controller-heavy hooks still remain in `ui` and should continue moving into `application`. Domain folders should contain only pure code.

Feature public APIs use explicit `public/*` contracts only. Broad `public/index.ts` barrels are not part of the current mobile architecture contract. Wildcard re-exports are not allowed.

There is still no feature-local `navigation` layer in the current app structure. Navigation ownership remains centralized under `app-shell/navigation`.

## Working Rules

- Keep mobile reads projection-first.
- Treat SQL/RPC-backed projections as the source of truth for read-heavy surfaces.
- Keep compat GET handlers rollback-only.
- Put reusable app shell code under `app-shell`, not under a revived `core` root.
- Put infrastructure under `platform`, not under a revived `infra` or `lib` root.
- Put shared UI and static catalogs under `shared`.
- Put feature-specific business flows under `features`.
- No ad hoc feature-to-feature imports. Cross-feature access must go through an explicit `public/*` contract, and `features/content-cards/public/*` is the only approved shared feature surface today; all other shared code belongs in `shared/` or `data/`.
- `data/social` owns blocked/followed visibility cleanup across caches; features must not route that behavior through each other.
- New shared UI code should prefer direct component modules over expanding `shared/components/index.ts` unless the grouped export is a deliberate public boundary.
- No lazy `require()` or dynamic import cycle breakers. The dependency graph must be acyclic.
- No wildcard barrel exports. All barrels must use explicit named exports.
- Domain folders must contain only pure code. Impure hooks go in `application`.
- Platform never imports from data, features, or app-shell.
- No boilerplate comment headers. Comments should explain non-obvious logic only.
- `src/mobile` keeps a hard 500-line guard. Files crossing roughly 300 lines should be treated as refactor candidates and split into focused modules.

## Backend Policy

- Supabase schema changes must go through `supabase/migrations`
- server rollback handlers live under `supabase/functions/server`
- production auth recovery routes remain env-driven
- password fallback routes remain unmounted from the server entrypoint
