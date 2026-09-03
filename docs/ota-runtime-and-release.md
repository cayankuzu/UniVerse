# OTA Runtime and Release Contract

## Scope and current truth

This contract governs EAS Update for the existing UniVerse mobile product. It does not add a
screen, route, notification type, setting, or product behavior. SQL/RPC remains the source of truth
for read-heavy flows, and OTA must never be used to turn rollback-only compat reads into a primary
path.

Repository configuration currently resolves to:

| Field                  | Repository source            | Current value                                             |
| ---------------------- | ---------------------------- | --------------------------------------------------------- |
| App version            | `config/app-release.json`    | `1.0.134`                                                 |
| Runtime version        | `config/app-release.json`    | `1.0.134`                                                 |
| Android application ID | `config/app-release.json`    | `com.ogrencisosyalagi.app`                                |
| Android version code   | `config/app-release.json`    | `134`                                                     |
| iOS bundle ID          | `config/app-release.json`    | `com.ogrencisosyalagi.app`                                |
| iOS build number       | `config/app-release.json`    | `134`                                                     |
| Expo owner/project     | `app.config.js` / `app.json` | `cayanns-team` / `c7565eaa-d013-430f-9576-217c4beefa3f`   |
| Update URL             | app/native config            | `https://u.expo.dev/c7565eaa-d013-430f-9576-217c4beefa3f` |
| Preview target         | `eas.json`                   | environment `preview`, channel `preview`                  |
| Production target      | `eas.json`                   | environment `production`, channel `production`            |

`app.config.js`, `app.json`, Gradle, and the Android manifest consume or guard these values; this
hardening does not change any identifier or runtime. Android source declares Expo Updates enabled,
checks on launch, waits zero milliseconds, and reads the runtime from the generated
`expo_runtime_version` resource. There is no checked-in `ios/` tree: iOS native configuration is
generated from `config/ios-prebuild.json` during an iOS EAS build.

These source facts do **not** prove that a published Android or iOS binary accepts OTA updates.
Neither a store-provenance AAB/APK nor an IPA/TestFlight artifact is committed with a current
inspection report. A published-binary inspection for both platforms is therefore a production
precondition. Until it exists, the truthful state is `RELEASE NO-GO`.

Push registration or delivery evidence is a separate requirement. It may exercise an installed
runtime, but it cannot prove update selection, runtime compatibility, rollout state, or rollback.
Track it independently through [push-real-device-matrix.md](push-real-device-matrix.md).

No Expo Update code-signing certificate or metadata is configured in the repository. The workflows
therefore do not request a private signing key and do not claim signed-update verification. Adding,
rotating, or removing an update certificate changes the native runtime and requires a new runtime
version and new Android/iOS binaries before signed updates can be published. See Expo's
[code-signing contract](https://docs.expo.dev/eas-update/code-signing/).

### Read-only provider snapshot on 2026-08-30

An authenticated, read-only EAS CLI audit was run during this hardening with `eas-cli/22.0.0` (the
release workflows pin the subsequently available `23.0.0`). This is a time-bounded observation; raw
provider output was not attached to this candidate, so it is **not** release evidence:

- `eas build:list --platform ios --status finished --limit 20 --json --non-interactive` and
  `eas build:view 5ccd23aa-2cf1-4749-a167-2c9de76e05fc` returned a finished production/store iOS
  build with SDK `55.0.0`, runtime/version/build `1.0.133/1.0.133/133`, fingerprint
  `6d486bd2e2e8b816fed8511e0ba4b7855a6f8f76`, and declared commit
  `ed4d2c675a6d88c408ab0cd58ce98ce64c7f0f59`.
- That declared commit contains app/runtime `1.0.128` in its committed `app.json`, not `1.0.133`.
  The exact cause cannot be proven; a dirty/non-reproducible upload is only an inference. The build is
  therefore invalid as same-SHA release evidence.
- `eas build:list --platform android --limit 20 --json --non-interactive` returned only canceled build
  `f33eb738-800f-4950-b899-d1c70637073b`, without an artifact. This does not prove that an Android
  store binary does not exist outside the queried EAS project/page.
- `eas channel:list`, `eas update:list --branch production`, and `eas update:list --all` returned only
  the `production` channel and no update groups at query time. They did not return a provisioned
  preview channel/update. Provider state can change after this snapshot.
- A local Android release AAB exists in a build-output directory but has no same-SHA, provider, or
  store provenance and is not a published-artifact claim.

The repository has native/config/dependency changes after the iOS build's declared commit. Those
changes, plus the provider/source mismatch above, require a newly versioned runtime and reproducible
Android/iOS binaries before this candidate can become an OTA baseline. This document records the
blocker; it does not silently change the coordinated release version.

## Diff classification

`utils/guards/classify-ota-diff.cjs` compares two immutable, full 40-character commit SHAs. The base
must be an ancestor of the checked-out head. A production or preview publish also requires a clean
tracked tree, an `OTA_SAFE` result, and at least one actual mobile runtime source/asset change.

The overall result is the strictest changed path:

| Result                   | Examples                                                                                                                                                                                   | Release action                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `OTA_SAFE`               | Production `.js/.jsx/.ts/.tsx` under `src/mobile/app/**`, `src/mobile/main.tsx`, and root `index.ts`; tests/docs/evidence are neutral companions                                           | May proceed only through preview and the remaining release gates.                                 |
| `NATIVE_BUILD_REQUIRED`  | `android/**`, `ios/**`, `package*.json`, lockfiles, `app.json`, `app.config.*`, `eas.json`, release/iOS native config, plugins, permissions/entitlements, icons/splash/notification assets | Block OTA. Increment the runtime/build identity through the normal binary release process.        |
| `MANUAL_REVIEW_REQUIRED` | Supabase/migrations, Cloudflare/infra, environment contracts, build tooling, all workflows and classifier-policy changes, unclassified paths/extensions                                    | Block OTA. Split the commit or update policy in an earlier reviewed change; there is no override. |

Unknown paths, malformed git output, short/ambiguous revisions, non-ancestor bases, empty diffs, and
renames that cross into a native path all fail closed. The two sides of a rename are classified.
All current `assets/**` paths are classified native. A future OTA-asset directory would require a
separate reviewed policy, extension/size checks, and self-tests before it could be allowlisted.

Because this hardening explicitly adds `environment` fields to `eas.json`, any candidate range that
contains this configuration change is itself `NATIVE_BUILD_REQUIRED`. The classifier protects future
release ranges; its introduction is not permission to OTA this commit into older binaries.

Run the focused self-tests and a range check with:

```bash
node --test ./utils/guards/classify-ota-diff.test.cjs ./utils/ops/write-ota-update-evidence.test.cjs
node ./utils/guards/classify-ota-diff.cjs \
  --base <FULL_DEPLOYED_BASE_SHA> \
  --head <FULL_CANDIDATE_SHA> \
  --require-clean \
  --require-ota-safe \
  --require-ota-payload \
  --json-output artifacts/ota/classifier.json
```

Exit code `1` is an operational/validation failure. Exit code `2` is an intentional policy block.
Do not convert either to a warning.

## Environment isolation

SDK 55 requires EAS Update to select an EAS environment explicitly. The workflows always pass both
the channel and `--environment`; they never depend on a local `.env` file:

| Stage             | GitHub Environment | EAS environment | EAS channel  | Exposure                                  |
| ----------------- | ------------------ | --------------- | ------------ | ----------------------------------------- |
| Preview           | `preview`          | `preview`       | `preview`    | 100% of compatible preview-channel builds |
| Production canary | `production`       | `production`    | `production` | Initial 5% only                           |

`EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true` remains set in every build profile. The preview and
production EAS environment values must independently contain the correct public Supabase/edge URL,
publishable key, Sentry DSN, projection flags, owner, project, and release-channel values. Secrets
must not be stored in `eas.json` or an `EXPO_PUBLIC_*` value.

GitHub's `preview` and `production` Environments must be created by an owner. Production must require
reviewers and prevent self-review. Each environment gets its own minimum-scope `EXPO_TOKEN`; do not
reuse Cloudflare or Supabase credentials. A workflow declaration names the environment but cannot
prove that repository protection rules were enabled in the GitHub UI.

## Workflow contract

### Preview

`.github/workflows/eas-update-preview.yml` is manually dispatched at an immutable candidate SHA and
requires the full SHA of the last approved preview update. It:

1. verifies the exact checkout, full ancestor range, clean tracked tree, and protected Expo token;
2. runs the OTA/evidence self-tests and the fail-closed classifier;
3. runs repository security, lint, formatting, and Jest gates;
4. publishes to channel/environment `preview` with pinned `eas-cli@23.0.0`;
5. stores the real JSON/std-error returned by EAS CLI plus generated `eas-update-metadata.json`; and
6. writes and uploads a SHA-bound manifest plus SHA-256 sidecar.

The preview manifest deliberately leaves published-binary capability, real-device runtime, update
code signing, rollout health, and rollback drill claims `false`. A successful CLI call is not a
device test.

### Production

`.github/workflows/eas-update-production.yml` is manual, targets the protected `production`
Environment, and only runs at the exact current `main` tip. It additionally requires:

- a successful preview workflow run for the identical candidate SHA;
- the preview artifact name `eas-update-preview-evidence-<candidate-sha>` and valid checksums;
- a committed Android+iOS published-binary inspection report under
  `release-evidence/published-binaries/*.json`; and
- a fully `OTA_SAFE` production-base-to-candidate range with a real OTA payload.

The production workflow publishes the new group at exactly 5%. It does not auto-promote to 20%,
50%, or 100%. Those mutations require observed provider/Sentry/runtime health evidence at each stage;
automation cannot manufacture that evidence.

The binary inspection JSON consumed by the workflow has this contract:

| Field                                   | Required meaning                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `schemaVersion`                         | Integer `1`                                                                                 |
| `kind`                                  | `published-binary-ota-capability`                                                           |
| `platforms.android` and `platforms.ios` | Both must exist; a single-platform claim is insufficient for an all-platform publish.       |
| `updatesEnabled`                        | Boolean `true`, read from the inspected installed/store artifact rather than source config. |
| `runtimeVersion`                        | Exact current `config/app-release.json` runtime.                                            |
| `updateUrl`                             | Exact project update URL shown above.                                                       |
| `channel`                               | `production`, as observed in the binary/build metadata.                                     |
| `artifactSha256`                        | SHA-256 of the inspected AAB/APK/IPA.                                                       |
| `artifactReference`                     | Immutable location or provider build ID for that artifact.                                  |
| `inspectionTool`                        | Tool and version used to extract the values.                                                |

Do not create this file from expected repository values. It is evidence only when populated from
actual Android and iOS artifacts and reviewed in the protected production environment.

## Release sequence

1. Determine the last approved/deployed SHA from provider evidence, not from a guessed branch name.
2. Inspect current published Android and iOS artifacts and commit the structured report above.
3. Confirm the release range does not contain native, dependency, config-plugin, permission,
   entitlement, scheme, Firebase/native config, update-certificate, or runtime changes.
4. Dispatch preview at the candidate SHA using the last preview SHA as the base.
5. On compatible preview binaries, test cold/warm start, offline embedded/cached start, runtime match
   and mismatch, old-binary compatibility, invalid signature behavior when signing is actually
   configured, auth/session restore, projection-first P0 flows, and no forced reload during a
   mutation/upload.
6. Attach device, Sentry, and EAS evidence to the same candidate SHA. A test filename is not runtime
   evidence.
7. From the exact `main` candidate, dispatch production using the last production SHA and preview run
   ID. GitHub production approval is mandatory.
8. Observe the 5% group. Promote manually to 20%, 50%, and 100% only after the approved health window
   and metrics are attached. Use the same update group; do not publish a new group merely to widen a
   rollout.
9. Record update group IDs, runtime, channel, requested/observed rollout, artifact checksums, device
   matrix, approver, and rollback owner.

At every stage, inspect crash-free sessions, failed update launches, startup time, auth failures, and
the existing critical-flow error ratios. Thresholds must come from the approved baseline/SLO; no
threshold or `PASS` may be invented for a run that was not observed.

## Evidence and remaining NO-GO gates

Workflow artifacts are named with the immutable candidate SHA and retain:

- base/head/tree SHAs;
- runtime and native identities from `config/app-release.json`;
- classifier report and checksum;
- classifier policy SHA-256 and generated EAS update metadata checksum;
- raw EAS CLI JSON/stderr and checksums;
- workflow run ID/attempt and target environment/channel;
- same-SHA preview manifest validation for production; and
- explicit `false` claims for runtime/provider facts the workflow did not observe.

The following remain external gates until evidence is attached to the same commit:

- GitHub Environment protection and least-privilege token review;
- Android and iOS published-artifact inspection;
- provisioned preview/production EAS environments and channels;
- preview device test on both platforms, including old binaries and offline startup;
- Sentry/update health at 5%, 20%, 50%, and 100%;
- code-signing plan/certificate/new binary if the Expo account plan supports it; and
- previous-update and embedded-update rollback drills.

Repository implementation is not a release approval:

`IMPLEMENTATION COMPLETE, RELEASE NO-GO UNTIL LISTED MANUAL/RUNTIME EVIDENCE IS ATTACHED TO THE SAME COMMIT SHA.`
