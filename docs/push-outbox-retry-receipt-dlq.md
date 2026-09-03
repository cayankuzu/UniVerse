# Push outbox, retry, receipt, and terminal-failure contract

## Dispatch path

Notification inserts enqueue the existing `notification_push_dispatch_queue` record and invoke the
existing dispatch wakeup. The worker claims the queue with a 90-second lease, processes bounded
batches (24 records, up to 3 passes), and records delivery/ticket state in
`notification_push_deliveries`. Each provider attempt also uses a short recipient/token-revision
lease: claim validates preference, block state, app environment, active owner, and token project;
consume repeats those checks immediately before provider I/O. Registration, tombstone, and owner or
generation changes invalidate provider-unconfirmed leases.

The remote payload is always generic (`UniVerse` / `Yeni bir bildirimin var.`) and carries only the
opaque notification ID. The authenticated mobile projection resolves all visible content and
navigation metadata after open. This keeps the unavoidable consume-to-provider network gap
privacy-safe even if the physical token is reassigned during that gap.

The queue retry policy is source-defined: a notification has at most six attempts, with scheduled
retry delays of 5, 10, 20, 40, and 80 seconds before terminal `failed` state. A public wakeup can
only drain already queued work; direct notification enqueue is restricted to authorized callers.

## Expo tickets and receipts

Expo send responses are ticketed before delivery is assumed. Receipt reconciliation starts after a
15-minute eligibility window and expires a still-pending receipt after 24 hours. The existing
five-minute `pg_cron` wakeup requests a drain/receipt pass. `DeviceNotRegistered`-class outcomes
deactivate the server token instead of retrying it as a transient delivery failure.

`EXPO_ACCESS_TOKEN` is optional configuration for Expo transport only; it is not a mobile value and
must never appear in evidence. The ticket/receipt service groups messages by EAS project ID so a
mixed-app request cannot cause a valid group to share a provider request with an incompatible one.

## Terminal failures and "DLQ" terminology

There is no separate user-visible DLQ, replay route, or new product table. The existing queue's
terminal `failed` state is the operational dead-letter boundary. Operators must not manually alter
user notifications or fabricate delivery success. They should:

1. capture candidate SHA, notification/queue IDs, sanitized error class, attempt count, and provider
   status without raw tokens or message content;
2. distinguish a transient transport/provider incident from permanent token invalidation;
3. use the existing domain event/notification flow for any approved re-emission after the root cause
   is fixed—never add a broad replay endpoint during an incident; and
4. attach staging/provider evidence before changing retry limits, credentials, or dispatch policy.

This is source-contract documentation only. It does not prove that `pg_cron`, database webhooks,
Expo tickets, or receipts are enabled in a particular remote environment.
