const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  collectFeatureSurface,
  compareFeatureSurface,
} = require("./check-no-new-product-surface.cjs");

const rootDir = path.resolve(__dirname, "../..");
const snapshot = JSON.parse(
  fs.readFileSync(path.join(rootDir, "quality/feature-surface.snapshot.json"), "utf8"),
);

function cloneBaseline() {
  return structuredClone(snapshot.protectedSurface);
}

test("repository source matches the committed feature-freeze snapshot", () => {
  const current = collectFeatureSurface(rootDir);
  const result = compareFeatureSurface(snapshot, current);
  assert.deepEqual(result.violations, []);
});

test("rejects additions across user-visible and product-domain surfaces", () => {
  const current = cloneBaseline();
  current.navigation.rootLeafRoutes.push("Calendar");
  current.navigation.screenEntrypoints.push(
    "CalendarScreen|src/mobile/app/features/calendar/public/screens.ts|src/mobile/app/features/calendar/ui/CalendarScreen.tsx",
  );
  current.notifications.types.push("reminder");
  current.notifications.postgresTypes.push("reminder");
  current.native.devicePermissionKeys.push("location");
  current.settings.itemKeys.push("premium");
  current.api.httpRoutes.push("GET /make-server-e3557d40/calendar");
  current.database.allTables.push("public.saved_searches");
  current.catalog.categories.valueCount += 1;
  current.catalog.categories.valueSha256 = "changed";
  current.policy.forbiddenProductPanelHits.push("src/admin/AdminPanel.tsx:path");

  const result = compareFeatureSurface(snapshot, current);
  assert.ok(result.violations.some((item) => item.includes("navigation.rootLeafRoutes")));
  assert.ok(result.violations.some((item) => item.includes("navigation.screenEntrypoints")));
  assert.ok(result.violations.some((item) => item.includes("notifications.types")));
  assert.ok(result.violations.some((item) => item.includes("notifications.postgresTypes")));
  assert.ok(result.violations.some((item) => item.includes("native.devicePermissionKeys")));
  assert.ok(result.violations.some((item) => item.includes("settings.itemKeys")));
  assert.ok(result.violations.some((item) => item.includes("api.httpRoutes")));
  assert.ok(result.violations.some((item) => item.includes("database.allTables")));
  assert.ok(result.violations.some((item) => item.includes("catalog.categories.valueCount")));
  assert.ok(result.violations.some((item) => item.includes("catalog.categories.valueSha256")));
  assert.ok(result.violations.some((item) => item.includes("policy.forbiddenProductPanelHits")));
});

test("allows only narrowly named internal hardening additions", () => {
  const current = cloneBaseline();
  current.api.directRelations.push("security_request_audit");
  current.api.httpRoutes.push("POST /make-server-e3557d40/ops/replay-outbox");
  current.api.rpcNames.push("event_mutation_audit");
  current.database.allTables.push("public.ops_release_evidence");
  current.database.allTables.push("public.delivery_provider_receipts");
  current.native.expoPluginIds.push("expo-updates");

  const result = compareFeatureSurface(snapshot, current);
  assert.deepEqual(result.violations, []);
  assert.equal(result.allowed.length, 6);
});

test("rejects removal or remapping of an existing surface", () => {
  const current = cloneBaseline();
  current.navigation.screenEntrypoints = current.navigation.screenEntrypoints.slice(1);
  current.api.httpRoutes = current.api.httpRoutes.slice(1);

  const result = compareFeatureSurface(snapshot, current);
  assert.ok(result.violations.some((item) => item.includes("screenEntrypoints: removed")));
  assert.ok(result.violations.some((item) => item.includes("httpRoutes: removed")));
});
