# Private Repo Continuity

This private repository lets a new machine restore source code and non-secret build configuration from a plain clone. App identity, signing continuity, and provider access are restored separately from approved secret stores.

## Repo contents

- all source code
- Android native project files
- Supabase migrations and Edge Functions
- assets, tests, scripts, and build configuration
- `android/sentry.properties`
- references to provider-managed release configuration, without credential values

## Secret and signing material

- local `.env` files
- Apple/Firebase platform configuration files
- Apple API and push-auth private keys
- Firebase/Google Cloud service-account JSON
- Android signing properties and keystores
- materialized Android Google Services configuration
- local Supabase project-link metadata (`supabase/.temp/linked-project.json` and `project-ref`)

These paths are intentionally ignored by Git. Do not add them to a commit, pull request, artifact, log, issue, or chat transcript.

Production values must come from the relevant provider secret store: GitHub Actions, EAS, Supabase, Sentry, Apple, Firebase/Google Cloud, or Google Play. An offline recovery copy is allowed only in access-controlled encrypted storage outside the repository.

## Not included

- `node_modules/`
- `.expo/`
- `android/.gradle/`
- `android/build/`
- `android/app/build/`
- `android/app/.cxx/`
- `*.apk`
- `*.aab`
- other generated build outputs and caches

## New machine setup

1. Install Git, Node.js 20+, Java 17, Android Studio, Android SDK platform tools, and an NDK version compatible with the committed Android config.
2. Clone the private repo.
3. Obtain the required development or release secrets through the approved provider or encrypted recovery process.
4. Materialize file secrets only into the Git-ignored paths expected by the build scripts.
5. Run `npm ci`.
6. Ensure `ANDROID_HOME` or `ANDROID_SDK_ROOT` points to the installed Android SDK.
7. Run `npm run check`.
8. For release/security verification, run `npm run security:verify:internal`.
9. Sign into an Expo account that can access `@cayanns-team/universe`, or accept the pending invite for that team/app before running `eas build`.

## Android commands

- Debug APK:
  `cd android`
  `set NODE_ENV=development`
  `gradlew.bat assembleDebug`

- Release AAB:
  `cd android`
  `set NODE_ENV=production`
  `set SENTRY_DISABLE_AUTO_UPLOAD=true`
  `gradlew.bat bundleRelease`

## Supabase commands

- Migrations + `server` function:
  `npm run deploy:supabase`

- Function only:
  `npm run deploy:functions`

Supabase CLI deploy requires either:

- a valid `SUPABASE_ACCESS_TOKEN`, or
- a prior `supabase login`

## iOS note

There is no committed `ios/` native project in this repo.

If iOS build work is needed:

1. Run `npx expo prebuild --platform ios`
2. Open the generated Xcode project/workspace
3. Build locally or with EAS

## Release/signing note

- The Android upload keystore and `android/keystore.properties` stay outside Git. Google Play App Signing remains the production signing authority; the upload key is recovered from its approved encrypted backup when needed.
- Apple distribution certificates/profiles and the Google Play App Signing private key remain external platform-managed assets and are not part of the repo.
- If local Sentry auth is missing or expired, release bundle creation can still continue with:

`SENTRY_DISABLE_AUTO_UPLOAD=true`

## Security note

Private-repository access does not make committed credentials safe. If a secret or signing file is ever committed or copied to an unapproved location, treat it as exposed, revoke or rotate it at the provider, review audit logs, and follow `docs/credential-incident-response.md`.
