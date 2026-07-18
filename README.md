# UniVerse

Mobile-only Expo application with a committed native Android build and a Supabase backend.

## Quick Start

Run `npm install` to install dependencies.

Run `npm run start` to start the Expo dev server.

Run `npm run android` to launch the committed native Android build.

For Android development builds:

- Run `npm run start:android:device` for a USB-connected physical device. This uses `adb reverse` and `--host localhost` so the dev client does not depend on LAN reachability.
- Run `npm run start:android:emulator` for an Android emulator.
- Run `npm run start:android:device:lan` or `npm run start:android:device:tunnel` only when you explicitly need LAN or tunnel transport.

Run `npm run check` before finishing changes.

## Expo / EAS Target

This repo now targets the Expo project `@cayanns-team/universe`.

Before running `eas build`, make sure the Expo account you are signed into has access to that team/app. If `eas project:info` returns an authorization error, sign into the correct Expo account or accept the pending team/app invitation first.

## Clone Recovery

After cloning the repo, run `npm ci` first so local toolchain commands like `tsc` are available again.

This private repo commits the project's continuity-critical secret and signing material on `main` so a fresh clone can continue release work with the same app identity.

Keep the Desktop backup folder `UniVerse_secrests` in sync and copy it to encrypted offline storage as a second recovery path.

There is no committed `ios/` native project in this repo. iOS builds require Expo prebuild/EAS to generate native files from the committed Expo config before building.

## New Machine Setup

1. Install Node.js 20+, Java 17, Android Studio/SDK, and Git.
2. Clone the private repo.
3. If any continuity files are missing locally, restore them from `UniVerse_secrests` with `powershell -ExecutionPolicy Bypass -File .\\utils\\ops\\restore-private-secrets.ps1 -BackupRoot "<path-to-UniVerse_secrests\\repo-root>" -ProjectRoot "<cloned-repo-path>"`.
4. Run `npm ci`.
5. Ensure Android SDK is available via `ANDROID_HOME` or `ANDROID_SDK_ROOT`.
6. Run `npm run check`.

## Supabase Deploy

- Run `npm run deploy:supabase` to push pending migrations and deploy the `server` Edge Function.
- This requires a valid `SUPABASE_ACCESS_TOKEN` or a prior `supabase login`.
- The deploy script resolves the project ref from `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, or the local linked ref file when available.

## Native Build Notes

- Android release bundle: `cd android && .\\gradlew.bat bundleRelease`
- Android debug APK: `cd android && .\\gradlew.bat assembleDebug`
- Local release builds may need `SENTRY_DISABLE_AUTO_UPLOAD=true` if the Sentry auth token is no longer valid.
- iOS native sources are not committed. Generate them with `npx expo prebuild --platform ios` before any Xcode/iOS build work.
- Apple distribution certificates/profiles and Google Play App Signing's server-held key are still external to the repo.
- Critical continuity files are committed on private GitHub `main` and mirrored into the Desktop backup folder `UniVerse_secrests`.

## Project Shape

The live mobile app is organized under:

- `src/mobile/app/app-shell`
- `src/mobile/app/data`
- `src/mobile/app/features`
- `src/mobile/app/platform`
- `src/mobile/app/shared`

Primary backend and database work lives under:

- `supabase/functions/server`
- `supabase/migrations`
- `supabase/validation`

## Current Architectural Rules

- Mobile reads are projection-first.
- SQL/RPC-backed reads are the source of truth for read-heavy flows.
- Compat GET handlers are rollback-only and must not become the primary path again.
- Supabase schema changes must go through migrations in `supabase/migrations`.

## Useful Commands

- `npm run check` validates types, file-size limits, architecture boundaries, runtime hygiene, server route size, and UTF-8 hygiene.
- `npm test` runs the Jest suite.
- `npm run security:verify:internal` runs the internal security verification path.
- `npm run release:verify` runs the full local release verification pipeline and requires additional local tooling.

## Docs

Start with these repo docs when you need more context:

- `src/mobile/ARCHITECTURE.md`
- `supabase/ARCHITECTURE.md`
- `docs/mobile-architecture-blueprint.md`
- `docs/database-architecture-blueprint.md`
