# Push incident and credential-rotation runbook

## Safety boundary

This runbook operates only the existing push delivery path. Do not add a notification type, route,
screen, setting, direct database access path, or legacy-read fallback during an incident. Do not
reset production data or delete queue/delivery evidence as a first response.

Before any provider or credential mutation, open an incident record with UTC start, owner, affected
environment, immutable candidate SHA, app/runtime/channel, affected platforms, sanitized queue and
receipt counts, and the last known-good provider observation. Raw Expo tokens, access keys, JWTs,
notification body/detail, e-mail, and signed URLs are prohibited from the record.

## Triage

| Signal                                  | Immediate safe action                                                                                                                                                 | Do not do                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Register failures                       | Check authenticated route, rate-limit outcome, migration/RPC deployment parity, and redacted Edge errors in a preview environment.                                    | Expose the table/RPC to mobile callers or bypass user binding.                |
| Send/ticket errors                      | Pause rollout/side-effect source if necessary; classify transient versus permanent Expo failure.                                                                      | Mark notification delivery successful from a ticketless request.              |
| `DeviceNotRegistered`                   | Let existing receipt/ticket handling deactivate the token; verify a fresh registration on a test device.                                                              | Retry the invalid token indefinitely.                                         |
| Receipt backlog/terminal queue failures | Preserve queue/delivery evidence, inspect cron/webhook/credential/provider health, and use approved synthetic staging reproduction.                                   | Add an ad-hoc public replay endpoint or mutate historical user notifications. |
| Suspected account-switch leakage        | Halt affected rollout, verify migration version and same-installation user A/B behavior in isolated staging, then ship only a forward corrective migration if needed. | Delete broad token sets or roll back the forward migration in production.     |

## Credential rotation

`EXPO_ACCESS_TOKEN` is used only by the server Expo send/receipt services. `PUSH_DISPATCH_WEBHOOK_SECRET`
authorizes internal dispatch wakeups. `SUPABASE_SERVICE_ROLE_KEY` authorizes server-side data work and
must never be copied to a client. Rotate each environment independently.

1. Create the replacement credential in the approved provider secret store and record its opaque
   version/creation time, not its value.
2. Deploy the secret to the isolated preview server environment; keep the previous credential only
   for the shortest approved overlap needed by the provider.
3. Exercise synthetic push registration, ticket, receipt, inactive-token, and unauthorized-dispatch
   checks. Preserve sanitized results and verify no secret reaches logs or artifacts.
4. Promote through the protected production procedure only after owner approval and observation.
5. Revoke the old credential, verify failures do not spike, and close the incident with SHA, secret
   version identifiers, evidence links, and rollback owner.

If a credential may be exposed, revoke it first, restrict provider access, preserve sanitized
forensics, and follow [credential-incident-response.md](credential-incident-response.md). A source
change is not required merely to rotate a provider secret; do not publish an OTA to rotate a
server-side secret.
