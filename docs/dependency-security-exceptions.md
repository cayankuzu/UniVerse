# Dependency Security Exceptions

Production dependency audit exceptions are fail-closed and machine checked by
`npm run guard:dependency-audit`. An exception must identify one advisory and package, declare
that it is not runtime reachable, and contain an owner, reason, and expiry date.

An advisory is only eligible for an exception when no installable patched release exists. When a
patched release does exist it is pinned through `overrides` in `package.json` instead — for example
`browserslist` is pinned to `^4.28.8` so `GHSA-c83g-rgw3-j3cx` and `GHSA-73wf-gq98-2v4g` are fixed
rather than accepted.

| Advisory              | Package                | Reachability                                                                                                                                                 | Fix status                                                                                                                  | Exploit surface                                                                                                              | Upgrade risk                                                                                                                         | Owner           | Expiry     |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ---------- |
| `GHSA-w3rx-r6r6-pgpr` | `image-size`           | Build-only, transitive through Metro; not bundled into the mobile app                                                                                        | No patched release as of 3 September 2026 (`2.0.2` is latest and in range)                                                  | A malicious ICNS asset committed to the repository could stall a development/CI Metro build                                  | Forcing an Expo/React Native downgrade would break SDK 55 compatibility and does not provide an acceptable production fix            | Mobile Platform | 2026-09-30 |
| `GHSA-5p2g-fcmc-qvqq` | `image-size`           | Build-only, transitive through Metro; not bundled into the mobile app                                                                                        | No patched release as of 3 September 2026 (`2.0.2` is latest and in range)                                                  | A malicious JXL/HEIF asset committed to the repository could stall a development/CI Metro build                              | Forcing an Expo/React Native downgrade would break SDK 55 compatibility and does not provide an acceptable production fix            | Mobile Platform | 2026-09-30 |
| `GHSA-6gmq-8vp8-gcm6` | `@xmldom/xmldom`       | Build-only, transitive through `@expo/plist` and `plist`; runs on the build host while prebuild materializes `Info.plist`/`AndroidManifest`, never bundled   | Every published `0.8.x` release is in the advisory range; `@expo/plist` constrains the dependency to `^0.8.8`               | Requires attacker-controlled XML at prebuild time; the only XML parsed is repository-owned native config                     | Forcing `0.9.x` violates `@expo/plist`'s declared range and would require forking Expo's config plugins                              | Mobile Platform | 2026-12-31 |
| `GHSA-vcc3-ghjq-m6fr` | `decode-uri-component` | Mitigated and unreachable: only reached via `query-string` inside `@react-navigation/core`'s `getStateFromPath`, which the app now replaces (see note below) | `0.5.0` is patched but ESM-only, and `query-string@7` pins `^0.2.2` and `require()`s it, so it cannot be installed as a fix | Would require a deep link whose malformed percent-encoded query reaches React Navigation's parser; that input is now dropped | Overriding to `0.5.0` breaks the CommonJS consumer at runtime, which is a worse outcome than the mitigated denial-of-service surface | Mobile Platform | 2026-12-31 |

## `GHSA-vcc3-ghjq-m6fr` mitigation

`src/mobile/app/app-shell/navigation/rootNavigation.linking.ts` supplies its own `getStateFromPath`
that strips the query and fragment before delegating to React Navigation. Both linked routes
(`AuthCallback`, `ResetPassword`) declare `undefined` params and the Supabase deep-link bridge parses
auth payloads itself before resetting to a scrubbed route, so routing behaviour is unchanged while
no attacker-controlled percent-encoded input reaches the vulnerable decoder.

The mitigation is enforced, not just documented:

- `npm run guard:security-mobile` fails closed if the hardened resolver or the strip is removed.
- `src/mobile/app/app-shell/navigation/rootNavigation.deepLink.test.ts` asserts that hostile query
  and fragment input resolves to exactly the same navigation state as the bare path, and that the
  linked screens never receive deep-link params.

Repository write access, pull-request review, and CI timeouts are the compensating controls for the
build-only entries. Remove each exception immediately when an installable patched release appears.
The gate fails on expiry, stale exceptions, or any unapproved advisory.

## SAST scope exclusions

`npm run security:sast` is a release gate, so every finding it reports has to be real. Eleven
build-time guard scripts under `utils/guards/` are excluded in `.semgrepignore` because they trip
taint rules that cannot apply to them:

| Rule                                                                        | Why it fires                                                                                                            | Why it cannot be exploited                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `javascript.lang.security.audit.path-traversal.path-join-resolve-traversal` | Each guard walks a directory tree with `path.join(directory, entry.name)`, and the walker's root arrives as a parameter | The roots are module constants pointing inside this repository. The scripts run on a developer machine or a CI runner, take no argument, and read no request, environment value or file the caller chooses. |
| `javascript.lang.security.audit.detect-non-literal-regexp`                  | `check-evidence-manifest.cjs` compiles `new RegExp(schema.pattern)`                                                     | The pattern comes from `quality/evidence-manifest.schema.json`, a file in this repository under review like any other source file.                                                                          |

Scope is per file, never per rule or per directory: every rule stays armed everywhere else, and all
product code under `src/`, `supabase/` and `infra/` is scanned unchanged. `npm run guard:secure-upload`
independently fails if `.semgrepignore` ever grows an entry that would hide `AndroidManifest.xml`
from native SAST.

Reviewed 2026-09-05. Owner: Mobile Platform.
