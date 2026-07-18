# Private Repo Continuity

This private repo is prepared so a new machine can continue development and release work with the same project identity and backend codebase from a plain clone. The same continuity set is also mirrored into the Desktop folder `UniVerse_secrests` so it can be copied to USB for offline recovery.

## Repo contents

- all source code
- Android native project files
- Supabase migrations and Edge Functions
- assets, tests, scripts, and build configuration
- `android/sentry.properties`
- committed secret/signing material required for repeatable builds

## Continuity secret set

- `.env`
- `GoogleService-Info.plist`
- `.secrets/app_store_push_bildiirm_ke_AuthKey_TRX8Y4P5SU.p8`
- `.secrets/AuthKey_DC34BUDLPC.p8`
- `.secrets/universe-da9c4-firebase-adminsdk-fbsvc-382635baf3.json`
- `android/keystore.properties`
- `android/keystores/sorita-release.jks`
- `android/app/debug.keystore`
- `android/app/google-services.json`

These files must exist in two places:

- private GitHub `main`
- the Desktop export folder `UniVerse_secrests`

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
3. If any continuity files are missing, connect the USB copy of `UniVerse_secrests`.
4. Run `powershell -ExecutionPolicy Bypass -File .\\utils\\ops\\restore-private-secrets.ps1 -BackupRoot "<path-to-UniVerse_secrests\\repo-root>" -ProjectRoot "<cloned-repo-path>"`.
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

- The Android upload keystore used by `android/keystore.properties` is committed to the private repo and also mirrored in `UniVerse_secrests`.
- Apple distribution certificates/profiles and the Google Play App Signing private key remain external platform-managed assets and are not part of the repo.
- If local Sentry auth is missing or expired, release bundle creation can still continue with:

`SENTRY_DISABLE_AUTO_UPLOAD=true`

## Security note

Because the continuity set now lives in both private GitHub and the USB backup, limit access to both and rotate credentials immediately if either location is exposed.
