import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fingerprintReportMutation } from "./reportIdempotency.ts";

test("report fingerprints are deterministic and bind the normalized payload", async () => {
  const base = {
    detail: "  ayrinti  ",
    reason: "spam",
    targetId: "target-1",
    targetType: "event",
    targetUsername: "Example_User",
  };
  assert.equal(
    await fingerprintReportMutation(base),
    await fingerprintReportMutation({ ...base, detail: "ayrinti", targetUsername: "example_user" }),
  );
  assert.notEqual(
    await fingerprintReportMutation(base),
    await fingerprintReportMutation({ ...base, targetId: "target-2" }),
  );
});

test("report idempotency stays migration-first, atomic, and backward compatible", () => {
  const root = new URL("../../../../", import.meta.url);
  const migration = readFileSync(
    new URL("supabase/migrations/20260831090000_report_submission_idempotency.sql", root),
    "utf8",
  );
  const route = readFileSync(
    new URL("supabase/functions/server/routes/discovery.reportRoutes.ts", root),
    "utf8",
  );
  const mobile = readFileSync(new URL("src/mobile/app/data/normalizers/reports.ts", root), "utf8");
  const worker = readFileSync(
    new URL("infra/cloudflare/universe-edge/src/schemas.ts", root),
    "utf8",
  );

  assert.match(migration, /unique \(reporter_id, client_mutation_id\)/i);
  assert.match(migration, /client_mutation_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/i);
  assert.match(route, /ignoreDuplicates:\s*true/);
  assert.match(route, /idempotency_key_reused/);
  assert.match(
    route,
    /body\.clientMutationId[\s\S]*:\s*viewerSupabase\.from\("reports"\)\.insert\(reportInsert\)/,
  );
  assert.match(mobile, /createClientMutationId\("report"\)/);
  assert.match(worker, /clientMutationId/);
});
