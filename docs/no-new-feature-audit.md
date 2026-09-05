# No-New-Feature Audit

## Decision

The repository feature baseline is frozen at commit
`1caace7fa52dd56e8fd968983b1b1a1ea36da7cd`. The current protected source inventory matches that
baseline: no screen, route, tab, modal mount, settings group/CTA, notification type/category, native
permission/entitlement, Storage bucket, product table, public product HTTP route, or content/filter
type was added or removed by the feature-freeze machinery.

This is repository evidence only. It does not replace a signed-artifact, staging, or real-device
release decision.

## Reviewed baseline change: modal-wrapper mounts 59 -> 58

`EventDetailLocationModal.tsx` and `EventCardLocationModal.tsx` were byte-identical apart from their
component name, their import order, and one label that rendered at 9px in one file and 10px in the
other. They are now a single `EventLocationModal`.

Both call sites are unchanged: `EventDetailInteractions` and `EventCardModals` each still render the
modal, so at runtime the same two surfaces open the same sheet as before. What dropped by one is the
static count of `<AppModalHost` occurrences in source, because two copies of the same implementation
became one.

The guard is right to stop on this — a falling mount count could just as easily mean a modal was
deleted — so it is recorded here rather than waved through. Every user-visible number is unchanged
and the guard confirms it on every run:

```
routes=24 screens=24 visibleTabs=4 notificationTypes=11
devicePermissions=4 settingsGroups=3 settingsItems=7 httpRoutes=51
```

Reviewed 2026-09-05. Rollback: restore the two files and set `modalMountCount` back to 59.

## Baseline versus guarded source

| Protected surface                     | Baseline | Guarded source | Result                       |
| ------------------------------------- | -------: | -------------: | ---------------------------- |
| Leaf navigation routes                |       24 |             24 | Same                         |
| Public screen entrypoints             |       24 |             24 | Same                         |
| Navigator tab routes                  |        3 |              3 | Same                         |
| Visible bottom-bar keys               |        4 |              4 | Same                         |
| Deep-link route mappings              |        2 |              2 | Same                         |
| Production modal-wrapper mounts       |       58 |             58 | Same fingerprint (see below) |
| Notification types                    |       11 |             11 | Same                         |
| PostgreSQL notification enum types    |       11 |             11 | Same                         |
| Notification filter categories        |        5 |              5 | Same                         |
| Android notification channels         |        1 |              1 | Same                         |
| Runtime device permission keys        |        4 |              4 | Same                         |
| Android manifest permissions          |        9 |              9 | Same                         |
| iOS entitlement keys in source config |        0 |              0 | Same                         |
| Settings groups                       |        3 |              3 | Same                         |
| Main settings item/CTA keys           |        7 |              7 | Same                         |
| Privacy switches                      |        2 |              2 | Same                         |
| Edge Function domains                 |        1 |              1 | Same                         |
| Defined server HTTP route literals    |       51 |             51 | Same                         |
| Mobile RPC names                      |       19 |             19 | Same                         |
| Migration-created tables              |       34 |             35 | Same protected; +1 internal  |
| Product-domain tables                 |       16 |             16 | Same                         |
| Storage buckets                       |        1 |              1 | Same                         |
| Visible catalog domains               |        7 |              7 | Same fingerprints            |
| User-facing message keys              |      486 |            486 | Same SHA-256 fingerprint     |
| Forbidden product-panel hits          |        0 |              0 | Same                         |

The visible bottom-bar count includes the existing club-only `create` action. It is not a fourth tab
navigator. The 51 HTTP route literals include 12 rollback-only compat routes and four conditional or
disabled auth routes; their presence in source does not make them production-primary.

## Guard implementation

`utils/guards/check-no-new-product-surface.cjs` rebuilds the inventory directly from repository
source and compares it to `quality/feature-surface.snapshot.json`. Collection order uses bytewise
sorting and SHA-256 where a full mount/key listing would make the snapshot noisy, so results do not
depend on timestamps or locale ordering.

The guard fails closed for:

- route, public screen entrypoint, tab, deep-link, or modal-mount drift;
- settings group/item/action or privacy-control count drift;
- mobile/PostgreSQL notification type, inbox category, notification channel/category drift;
- device permission, Android feature/intent scheme, iOS permission-key/entitlement drift;
- new Storage buckets, new product tables, or removed migration tables;
- new public product HTTP routes, Edge Function names, direct relations, or product domains;
- account/content/report/search/home-filter taxonomy or visible catalog-value drift;
- source paths that introduce an admin, moderator, or organizer product panel;
- added/removed translation keys or namespaces (copy text may still be corrected under an existing
  key without changing product scope).

The package scripts are:

```text
npm run guard:no-new-product-surface:self-test
npm run guard:no-new-product-surface
```

Both are part of `npm run check`.

## Narrow allowlist and review rule

The allowlist is intentionally based on technical naming boundaries, not arbitrary file paths:

| Allowed addition    | Required shape                                                                                                                                                                                                    | Why it does not expand product scope                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Internal DB table   | Explicit `internal_`, `ops_`, `security_`, `audit_`, `telemetry_`, `outbox_`, `delivery_`, `queue_`, `dlq_`, `release_`, or `ota_` prefix; or a narrow audit/delivery/queue/receipt/telemetry/replay-nonce suffix | Supports security, operations, delivery, or evidence only.                              |
| Internal HTTP route | Existing server prefix followed by `/internal/*` or `/ops/*`                                                                                                                                                      | Cannot be a public end-user product domain.                                             |
| Technical RPC       | Name starts with an already existing product domain such as `event_`, `album_`, `profile_`, or `viewer_`                                                                                                          | May make an existing flow atomic/projected without creating UI.                         |
| Native plugin       | `expo-updates`, `expo-asset`, `expo-build-properties`, or `@sentry/react-native/expo`                                                                                                                             | OTA/build/observability plumbing only; permission and entitlement checks remain strict. |

An allowlisted name is not automatic design approval. Reviewers must still answer: "Which existing
screen/route/feature becomes safer, faster, or more reliable?" An internal addition without a clear
answer must be rejected.

Changing the snapshot to make a guard failure disappear is prohibited. A snapshot update requires an
explicit product-scope decision, an update to `docs/existing-feature-contract.md`, and review of the
baseline/final feature comparison.

## Self-test evidence

The Node self-test covers four cases:

1. real repository source equals the snapshot;
2. representative calendar screen, mobile/PostgreSQL reminder notification, location permission,
   premium setting, public calendar endpoint, saved-search table, catalog-value, and admin-panel
   additions are rejected;
3. narrowly named ops/audit/OTA additions are accepted and reported as allowlisted;
4. removing or remapping an existing screen/API route is rejected.

Focused run on 2026-08-31:

```text
node --test ./utils/guards/check-no-new-product-surface.test.cjs
# tests 4, pass 4, fail 0

node ./utils/guards/check-no-new-product-surface.cjs
# [feature-freeze] PASS routes=24 screens=24 visibleTabs=4 notificationTypes=11
# devicePermissions=4 settingsGroups=3 settingsItems=7 httpRoutes=51 databaseTables=35
# database.allTables: allowed internal addition "public.internal_push_installation_state"
```

## Audit limitations

- This guard detects structural source drift; it cannot prove that a renamed existing button retains
  correct runtime behavior.
- Copy values may change under an existing key for bug, accessibility, or error-state corrections;
  review must confirm the new value does not advertise a new user job.
- The iOS inventory comes from the prebuild config because no `ios/` directory is checked in. A
  generated/signed artifact still requires separate inspection.
- Internal allowlisted additions still require migration, security, and contract tests appropriate to
  their risk.

## Audit conclusion

Repository feature-surface guard: **PASS**.

Product-scope conclusion: the starting and guarded end-user feature lists are the same. This result
does not by itself change the broader release status; missing runtime/manual evidence remains a
separate release gate.
