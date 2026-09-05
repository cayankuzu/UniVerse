# Push provider and token lifecycle

## Provider boundary

Expo Notifications acquires the device token. The mobile app sends that token only to the existing
authenticated `/push/register` route. The Supabase Edge Function sends Expo batches and later reads
Expo receipts; `EXPO_ACCESS_TOKEN`, when configured, remains server-side. EAS project IDs partition
delivery so tokens from mixed app projects are not combined into a provider batch.

Do not put Expo access tokens, service-role keys, webhook secrets, raw Expo tokens, ticket IDs, or
receipt bodies in client logs, documents, screenshots, or release evidence. The network/data
classification is authoritative in [network-and-data-inventory.md](network-and-data-inventory.md).

## Lifecycle

| Stage                                       | Existing behavior                                                                                                                                                                                                                                         | Failure rule                                                                                                                                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission                                  | The existing user-driven notification permission flow gates registration; Expo Go/local-disabled runtime skips provider registration.                                                                                                                     | No prompt is introduced. Failed cleanup retains the local registration.                                                                                                                                                                                     |
| Identity                                    | A UUID and installation-wide monotonically increasing generation are stored together in SecureStore, separately from the user-scoped token record.                                                                                                        | Storage failure prevents that registration attempt; it is retried by the existing sync triggers.                                                                                                                                                            |
| Registration                                | Login, permission grant, app foreground, and native token rotation schedule the existing bounded registration sync. Every actual register reserves a new generation before sending environment, platform, EAS project, Expo token, and installation UUID. | Auth/session and transport errors use existing bounded retry/cooldown behavior. A disposed/user-changed effect is aborted and cannot persist its result.                                                                                                    |
| Account switch                              | The service-role-only SQL RPC serializes the installation, rejects older or equal-conflicting generations, deactivates every prior token for that installation, then activates the current token.                                                         | Pure legacy rows with no installation/generation remain compatible. Once a token is generation-tracked, an unordered legacy replay cannot reactivate it.                                                                                                    |
| Logout                                      | Logout first reserves a newer generation and sends an installation tombstone, even when the local token record is missing, then waits a bounded 3.5 seconds before local sign-out.                                                                        | Only `success: true, applied: true` clears the captured token record. `applied: false`, failure, or timeout retains retry state. A late register older than the tombstone is rejected server-side; a late cleanup cannot delete a newer local registration. |
| Permission revoked / local runtime disabled | The same best-effort unregister helper is used.                                                                                                                                                                                                           | It retains the record when the server cannot confirm cleanup.                                                                                                                                                                                               |
| Provider invalidation                       | Expo `DeviceNotRegistered`-class ticket/receipt outcomes deactivate the affected server record.                                                                                                                                                           | Registration on a valid later token creates/re-activates the current record.                                                                                                                                                                                |
| Delivery lease                              | Claim and send-before-consume both bind recipient, environment, current installation owner, token/project/platform, generation, and token revision.                                                                                                       | Any register/tombstone/owner revision invalidates an unconfirmed lease. The provider-gap payload remains generic and contains only an opaque notification ID.                                                                                               |

Installation high-water state is retained to reject delayed replays. A per-owner transaction lock
enforces at most 64 permanent installation identities: existing installation retries remain
idempotent, while a 65th identity fails registration closed instead of growing internal state
without bound. Confirmed account deletion cascades all state owned by that profile.

The installation UUID is not an authentication factor. The endpoint binds `p_user_id` to the
authenticated Edge user; only the server's service-role client can invoke the SQL RPC. The client
does not get a direct table/RPC permission.

The legacy `claim_notification_push_deliveries` RPC is no longer executable by `service_role` once
the privacy-lease migration is applied. A pre-lease Edge rollback therefore fails push closed. Only
a lease-aware generic-payload Edge build is a valid rollback baseline; never restore the legacy RPC
grant as an incident workaround.

## Required staging checks

Before deployment, use synthetic user A and user B on one physical installation and verify all of
the following against a disposable environment:

1. user A registers; exactly one active record exists for the installation;
2. user A logs out while online; the record becomes inactive and the local token record clears;
3. user A logs out with the route blocked; logout completes, the local record remains, and no raw
   token appears in telemetry;
4. user B signs in and registers; any user-A active record in the same scope is inactive, including
   after token rotation; and
5. delayed A register responses cannot overtake either A's logout tombstone or B's newer register;
   and
6. a genuinely legacy registration without `installationId`/`generation` succeeds, while a replay
   of a generation-tracked token cannot reactivate it.

This is an execution checklist, not completed evidence. Preserve sanitized SQL counts, route logs,
and device/build identifiers with the candidate SHA.
