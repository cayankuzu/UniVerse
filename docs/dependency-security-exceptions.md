# Dependency Security Exceptions

Production dependency audit exceptions are fail-closed and machine checked by
`npm run guard:dependency-audit`. An exception must identify one advisory and package, declare
that it is not runtime reachable, and contain an owner, reason, and expiry date.

| Advisory              | Package      | Reachability                                                          | Fix status                              | Exploit surface                                                                                 | Upgrade risk                                                                                                           | Owner           | Expiry     |
| --------------------- | ------------ | --------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------- | ---------- |
| `GHSA-w3rx-r6r6-pgpr` | `image-size` | Build-only, transitive through Metro; not bundled into the mobile app | No patched release as of 19 August 2026 | A malicious ICNS asset committed to the repository could stall a development/CI Metro build     | Forcing Expo/React Native downgrade would break SDK 55 compatibility and does not provide an acceptable production fix | Mobile Platform | 2026-09-30 |
| `GHSA-5p2g-fcmc-qvqq` | `image-size` | Build-only, transitive through Metro; not bundled into the mobile app | No patched release as of 19 August 2026 | A malicious JXL/HEIF asset committed to the repository could stall a development/CI Metro build | Forcing Expo/React Native downgrade would break SDK 55 compatibility and does not provide an acceptable production fix | Mobile Platform | 2026-09-30 |

Repository write access, pull-request review, and CI timeouts are the compensating controls. Remove
each exception immediately when Expo/Metro publishes a dependency path containing a patched
`image-size` release. The gate fails on expiry, stale exceptions, or any unapproved advisory.
