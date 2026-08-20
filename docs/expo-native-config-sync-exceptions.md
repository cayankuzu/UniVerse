# Expo Native Config Ownership

Updated: 2026-08-19

The previous Expo Doctor native-config exception has been removed. Expo Doctor must pass without an allowlist or bypass.

- Android is native-managed from the committed `android/` project. Android package, runtime, version, permissions, icons, splash, Google services materialization, and signing behavior are owned by native files plus `config/app-release.json`.
- iOS is config-generated because an `ios/` project is not committed. EAS iOS builds set `EAS_BUILD_PLATFORM=ios`; `app.config.js` then materializes the native fields from `config/ios-prebuild.json` and the release source of truth.
- The neutral local Expo config intentionally omits prebuild-owned fields so it cannot imply that committed Android native files are synchronized automatically.

Release evidence must record the release manifest, Android native parity guard, Expo Doctor result, and the generated iOS archive metadata. Signing keys and Google service secrets remain injected and must never be committed.
