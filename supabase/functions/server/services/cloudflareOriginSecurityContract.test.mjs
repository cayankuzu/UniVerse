import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositoryRoot = new URL("../../../../", import.meta.url);
const readRepositoryFile = (relativePath) =>
  readFileSync(new URL(relativePath, repositoryRoot), "utf8");

test("the server and Worker keep the same selective route identifiers", () => {
  const serverSource = readRepositoryFile(
    "supabase/functions/server/services/cloudflareOriginVerification.ts",
  );
  const workerSource = readRepositoryFile("infra/cloudflare/universe-edge/src/routePolicy.ts");
  const collectRouteIds = (source) =>
    [...source.matchAll(/\bid:\s*"([a-z0-9.-]+)"/g)].map((match) => match[1]).sort();

  assert.deepEqual(collectRouteIds(serverSource), collectRouteIds(workerSource));
});

test("replay storage is RLS locked and executable only by service_role", () => {
  const migration = readRepositoryFile(
    "supabase/migrations/20260830150000_cloudflare_origin_replay_protection.sql",
  );

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on table[\s\S]*from anon/i);
  assert.match(migration, /revoke all on table[\s\S]*from authenticated/i);
  assert.match(migration, /grant select, insert, delete[\s\S]*to service_role/i);
  assert.match(migration, /on conflict \(nonce\) do nothing/i);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
});

test("auth failures never log bearer token prefixes", () => {
  const serverEntrypoint = readRepositoryFile("supabase/functions/server/index.ts");
  assert.doesNotMatch(serverEntrypoint, /tokenPrefix|token\.slice\s*\(/);
});

test("only a verified signed network key can override the origin transport address", () => {
  const serverEntrypoint = readRepositoryFile("supabase/functions/server/index.ts");
  const rateLimit = readRepositoryFile("supabase/functions/server/rateLimit.ts");
  const verifier = readRepositoryFile(
    "supabase/functions/server/services/cloudflareOriginVerification.ts",
  );

  assert.match(verifier, /x-universe-edge-client-network-key/);
  assert.match(
    serverEntrypoint,
    /result\.outcome === "verified"[\s\S]*markVerifiedClientNetworkKey/,
  );
  assert.match(rateLimit, /readVerifiedClientNetworkSubject\(c\.req\.raw\)/);
  assert.doesNotMatch(rateLimit, /header\("x-universe-edge-client-network-key"\)/);
});

test("production auth fallback remains unmounted", () => {
  const routeRegistry = readRepositoryFile("supabase/functions/server/routeRegistry.ts");
  const runtime = readRepositoryFile("supabase/functions/server/runtime.ts");
  assert.match(routeRegistry, /mountPasswordFallback:\s*false/);
  assert.match(runtime, /AUTH_RECOVERY_ENDPOINTS_ENABLED\s*=\s*\n?\s*!IS_PRODUCTION_EDGE/);
});
