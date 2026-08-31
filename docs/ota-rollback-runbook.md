# OTA Rollback Runbook

## Purpose and safety boundary

Use this runbook only for EAS Updates that target the existing UniVerse runtime. Worker, Supabase
function, database, OTA, and store-binary rollbacks are independent. An OTA incident must not be
"fixed" by enabling legacy edge reads, mounting production auth fallback routes, changing native
permissions, or publishing a mismatched runtime.

There is no application-level forced reload in the current source. Keep it that way during an
incident: do not reload while a form, upload, comment, attendance action, or other mutation is in
flight. A rollback is downloaded in the background and takes effect at the next safe cold start or
ordinary reload.

## Required incident record

Before mutating provider state, capture:

- incident ID, UTC start time, incident commander, Expo operator, and mobile owner;
- immutable source SHA and tree SHA;
- environment, channel, runtime version, update group ID, platform update IDs, and current rollout;
- raw `eas update:view <GROUP_ID> --json` output and its SHA-256;
- the preceding known-good group ID or embedded build identifiers;
- affected platform/build/runtime/device matrix;
- observed Sentry/EAS/startup/auth/P0-flow symptoms; and
- the production workflow evidence artifact and published-binary inspection report.

If the group ID, runtime, channel, or known-good target cannot be established, stop and escalate.
Guessing a branch/group during an incident can publish another bad update.

All commands below pin the reviewed CLI. Set `EXPO_TOKEN` in the protected operator environment; do
not paste it into a terminal transcript or evidence file.

```bash
npx --yes eas-cli@23.0.0 whoami --non-interactive
npx --yes eas-cli@23.0.0 update:view <BAD_GROUP_ID> --json > before-rollback.json
```

Hash the captured output and attach it to the incident record:

```bash
node -e "const fs=require('node:fs'),c=require('node:crypto');const b=fs.readFileSync('before-rollback.json');console.log(c.createHash('sha256').update(b).digest('hex'))"
```

## Triage decision

| Condition                                                              | First action                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Active 5/20/50% rollout is unhealthy                                   | Revert the rollout immediately; do not widen it.                                                                                     |
| 100% group is unhealthy and a preceding good group exists              | Roll back the latest bad group, which republishes the preceding group.                                                               |
| No preceding OTA is safe/available, but embedded binaries are verified | Publish a rollback-to-embedded directive for the exact runtime/channel.                                                              |
| Update was sent only to the wrong non-production channel               | Do not mutate production; inspect and clean up the wrong channel independently.                                                      |
| Runtime mismatch means clients never select the update                 | Confirm selection/launch telemetry; avoid an unnecessary rollback claim.                                                             |
| API/edge origin is broken but the JS bundle is good                    | Prefer independent edge/origin rollback if it is faster and contract-compatible. Keep projection-first and legacy-read gates intact. |
| Native/config/dependency change was mistakenly treated as OTA          | Revert the OTA exposure, then create and validate new native binaries/runtime.                                                       |

## A. Revert an active staged rollout

This is the preferred response while the bad group is still partially rolled out:

```bash
npx --yes eas-cli@23.0.0 update:revert-update-rollout \
  --group <BAD_GROUP_ID> \
  --message "incident <INCIDENT_ID>: revert unhealthy rollout" \
  --json \
  --non-interactive \
  > rollback-provider-output.json
```

Record the command exit status and provider JSON. Do not write "reverted" until `update:view` and a
compatible device confirm provider state and client behavior.

## B. Roll back the latest group to the preceding update

`update:rollback` requires the latest group for its branch/runtime. In non-interactive operation, the
bad group ID is mandatory. Expo republishes the preceding update, or the embedded update if no
preceding update exists.

```bash
npx --yes eas-cli@23.0.0 update:rollback <BAD_GROUP_ID> \
  --message "incident <INCIDENT_ID>: restore preceding update" \
  --platform all \
  --json \
  --non-interactive \
  > rollback-provider-output.json
```

If end-to-end update signing is configured for that runtime, add the reviewed
`--private-key-path <EPHEMERAL_PRIVATE_KEY_PATH>` argument. The private key may exist only in the
protected production secret store, must be written with restrictive permissions, and must be
securely removed at job end. Current UniVerse binaries/config do not prove code signing; do not add
the flag or claim signature verification today.

## C. Republish a specifically verified known-good group

Use this only after verifying the group belongs to the intended project, branch/channel, runtime,
and platform set:

```bash
npx --yes eas-cli@23.0.0 update:view <KNOWN_GOOD_GROUP_ID> --json > known-good-before.json
npx --yes eas-cli@23.0.0 update:republish \
  --group <KNOWN_GOOD_GROUP_ID> \
  --message "incident <INCIDENT_ID>: republish verified known-good group" \
  --platform all \
  --json \
  --non-interactive \
  > rollback-provider-output.json
```

Do not use an interactive `--branch` selection in production automation; a copied group ID is less
ambiguous and can be bound to evidence.

## D. Roll back to the embedded update

This is the last-resort OTA action when no previous OTA group is safe. It is valid only after the
embedded Android and iOS bundles for runtime `1.0.134` have been inspected and exercised offline.

```bash
npx --yes eas-cli@23.0.0 update:roll-back-to-embedded \
  --channel production \
  --runtime-version 1.0.134 \
  --message "incident <INCIDENT_ID>: return to verified embedded update" \
  --platform all \
  --json \
  --non-interactive \
  > rollback-provider-output.json
```

An embedded rollback cannot repair a broken native binary. If the store binary itself is faulty,
stop OTA rollout, use store phased-release controls where available, and ship a corrected binary
with the appropriate runtime/build version.

## Broken API base URL or edge cutover

1. Confirm whether the bad hostname is embedded in the OTA bundle, the native binary, or an external
   DNS/Worker route.
2. If it came from the bad OTA, use A/B/C above.
3. If the stable hostname is correct but the origin/Worker mapping is bad, roll back that independent
   deployment and verify its exact API contract.
4. Keep `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`; do not make compat GET handlers primary.
5. Test auth/session restore, Home/Search/Profile/Notifications projections, report/block, event and
   album mutations, media upload, and offline relaunch before closing the incident.

## Verification after any rollback

Capture provider state again:

```bash
npx --yes eas-cli@23.0.0 update:view <ROLLBACK_GROUP_ID> --json > after-rollback.json
```

Then verify, without forcing a mid-mutation reload:

1. affected preview devices first, then production devices for each published platform;
2. cold launch online, second launch after download, and offline embedded/cached launch;
3. selected channel/runtime/update ID in sanitized diagnostics;
4. auth/session restore and the existing P0 projection/mutation/upload flows;
5. crash-free sessions, failed update launches, startup time, auth failures, and critical-flow error
   ratios for the approved observation window; and
6. the expected long tail: already-downloaded bad updates may remain active until clients restart and
   receive the rollback.

Hash `rollback-provider-output.json`, `after-rollback.json`, device logs/screenshots, and the incident
timeline. Store them under the same incident/release SHA evidence bundle. Provider command success is
not device success; keep runtime claims `UNVERIFIED` until the device matrix completes.

## Failure and escalation

- If the rollback command fails, preserve stderr, do not retry with a guessed group, and escalate to
  the Expo/project owner.
- If clients reject the rollback signature, stop publishing. Validate the certificate/key ID,
  runtime, certificate expiry, and binary provenance. Key rotation requires a new runtime/binary.
- If offline launch fails, treat it as a binary/release P0 and halt rollout.
- If auth or projection-first paths regress after rollback, keep legacy compat disabled and escalate
  to the respective mobile/Supabase owners.
- If both previous and embedded updates are unsafe, declare release `NO-GO`, stop channel promotion,
  and prepare corrected store binaries.

## Closeout

Close only when the incident record contains provider before/after JSON, checksums, exact group IDs,
same-SHA/source mapping, Android+iOS device confirmation, observed health recovery, owner approval,
and a follow-up prevention item. A runbook rehearsal without real provider/device evidence must be
labelled `DRY RUN`, never `PASS`.
