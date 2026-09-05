# Push real-device validation matrix

## Evidence rule

An emulator install, source test, Expo CLI response, or successful `/push/register` response is not
physical-device or provider-delivery proof. Each completed row needs the exact candidate SHA,
signed build/runtime, EAS project/channel/environment, test account class, UTC timestamps, and
sanitized provider/receipt evidence. Never retain raw Expo tokens, JWTs, or notification content in
the report.

## Required matrix

| Scenario                          | Android physical device | iOS physical device | Required observed result                                                                                 |
| --------------------------------- | ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| First permission decision         | Pending                 | Pending             | Existing prompt timing, allow/deny behavior, and no new permission surface.                              |
| Foreground delivery               | Pending                 | Pending             | Existing notification presentation and inbox projection refresh; no duplicate/new type.                  |
| Background delivery               | Pending                 | Pending             | Tapping resolves the existing authenticated projection and existing destination only.                    |
| Terminated delivery               | Pending                 | Pending             | Cold start preserves auth/deep-link safety and reaches an existing destination or inbox fallback.        |
| Token rotation                    | Pending                 | Pending             | New token registers; old active installation-scope token becomes inactive after migration deployment.    |
| Logout online                     | Pending                 | Pending             | Unregister is confirmed; local token record clears; no later delivery to the signed-out account.         |
| Logout offline/auth failure       | Pending                 | Pending             | Logout completes within bounded time; local record is retained; redacted telemetry records retry need.   |
| Same-install account switch       | Pending                 | Pending             | User B registration leaves no active user-A token for the same installation scope.                       |
| Permission revoke                 | Pending                 | Pending             | Confirmed unregister clears; unconfirmed cleanup is retained and retried.                                |
| Invalid provider token            | Pending                 | Pending             | Ticket/receipt makes the server token inactive without retry loop.                                       |
| Upgrade and OTA-compatible launch | Pending                 | Pending             | Existing push response behavior survives a compatible native/runtime update; no claim from source alone. |

## Current status

No row above is marked PASS by this repository. The local debug APK/emulator setup used during
development is explicitly excluded from this physical-device matrix, and no Expo provider receipt
or remote migration result is attached. The candidate remains release NO-GO for push/deep-link
evidence until the matrix is completed in an isolated preview environment and then repeated for the
approved release path.

Use [ota-runtime-and-release.md](ota-runtime-and-release.md) for the separate runtime/channel and
OTA evidence gates; push testing must not be used as a substitute for published-binary OTA proof.
