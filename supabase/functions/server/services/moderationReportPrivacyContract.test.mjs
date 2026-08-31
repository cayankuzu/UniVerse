import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const reportService = readFileSync(
  new URL("supabase/functions/server/services/moderationReports.ts", root),
  "utf8",
);
const deliveryService = readFileSync(
  new URL("supabase/functions/server/services/moderationReportDelivery.ts", root),
  "utf8",
);
const route = readFileSync(
  new URL("supabase/functions/server/routes/discovery.reportRoutes.ts", root),
  "utf8",
);

test("moderation email contains only the case id and sanitized categorical metadata", () => {
  assert.doesNotMatch(reportService, /Reporter snapshot|Target snapshot|User supplied detail/);
  assert.doesNotMatch(reportService, /params\.(?:detail|reporterSnapshot|targetSnapshot)/);
  assert.doesNotMatch(deliveryService, /replyTo|reporterEmail/);
  assert.match(reportService, /Report ID:/);
  assert.match(reportService, /Target Type:/);
  assert.match(reportService, /Reason:/);
});

test("full report evidence remains in the protected database record", () => {
  assert.match(route, /reporter_snapshot:\s*reportSnapshots\.reporterSnapshot/);
  assert.match(route, /target_snapshot:\s*reportSnapshots\.targetSnapshot/);
  assert.match(route, /detail:\s*body\.detail \|\| null/);
});
