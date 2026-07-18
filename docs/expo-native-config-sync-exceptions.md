# Expo Native Config Sync Exceptions

Updated: 2026-07-15

This repository intentionally keeps the native `android/` project folder. The `ios/` project folder is not checked in; iOS native files must be generated from the committed Expo config during a controlled prebuild/archive flow for the target release commit. Expo Doctor's app config sync check is enabled, but the Android native-project warning is treated as a documented exception because EAS Build does not auto-sync these config fields once a native folder is present:

- `scheme`
- `icon`
- `plugins`
- `splash`
- `ios`
- `android`

Release owners must keep the checked-in Android project files and Expo config aligned manually. The package name, bundle identifier, app scheme, EAS project ID, version, build number, permission copy, Google services file injection, Sentry config, and signing identity must be checked in the release checklist before building.

iOS release verification must record the prebuild command/toolchain, commit SHA, generated entitlements, permissions, URL scheme, push configuration, PrivacyInfo output, bundle ID, and archive metadata as release evidence. The repository must not add signing file paths or private key material to source control.

This exception does not allow any other Expo Doctor failure. If Expo Doctor reports a different failed check, `npm run guard:expo-doctor` must fail.
