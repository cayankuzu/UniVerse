import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const forbiddenCredentialNames = new Set([
  ".npmrc",
  "credentials.json",
  "google-services.json",
  "googleservice-info.plist",
]);
const forbiddenCredentialExtensions = new Set([
  ".cer",
  ".crt",
  ".der",
  ".jks",
  ".key",
  ".keystore",
  ".mobileprovision",
  ".p8",
  ".p12",
  ".pem",
  ".pfx",
  ".pkcs12",
]);

function assertNoCredentialFiles(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    const lowerName = entry.name.toLowerCase();
    if (entry.isDirectory()) {
      if (lowerName === ".secrets") {
        throw new Error("Credential directory must not exist in the tooling image.");
      }
      if (lowerName === "node_modules") {
        continue;
      }
      assertNoCredentialFiles(entryPath);
      continue;
    }
    if (
      forbiddenCredentialNames.has(lowerName) ||
      lowerName.startsWith(".env") ||
      lowerName.startsWith(".dev.vars") ||
      forbiddenCredentialExtensions.has(extname(lowerName)) ||
      /firebase.*adminsdk/iu.test(entry.name) ||
      /service.*account/iu.test(entry.name)
    ) {
      throw new Error(`Credential-like file must not exist in the tooling image: ${entryPath}`);
    }
  }
}

if (existsSync("/workspace/.secrets")) {
  throw new Error("Credential directory must not exist in the tooling image.");
}
assertNoCredentialFiles("/workspace");

const commands = [
  ["node", ["utils/guards/check-loadtest-contracts.cjs"]],
  [
    "node",
    [
      "--test",
      "supabase/functions/server/services/cloudflareOriginVerification.test.mjs",
      "supabase/functions/server/services/cloudflareOriginSecurityContract.test.mjs",
    ],
  ],
  [
    "node",
    [
      "--test",
      "supabase/functions/server/services/reportIdempotency.test.mjs",
      "supabase/functions/server/services/moderationReportPrivacyContract.test.mjs",
    ],
  ],
  [
    "node",
    [
      "--test",
      "supabase/functions/server/services/pushInstallationAccountSwitch.contract.test.mjs",
    ],
  ],
  [
    "/workspace/infra/cloudflare/universe-edge/node_modules/.bin/wrangler",
    ["types", "./worker-configuration.d.ts", "--strict-vars=false", "--check"],
    "/workspace/infra/cloudflare/universe-edge",
  ],
  [
    "/workspace/infra/cloudflare/universe-edge/node_modules/.bin/tsc",
    ["--noEmit"],
    "/workspace/infra/cloudflare/universe-edge",
  ],
  [
    "/workspace/infra/cloudflare/universe-edge/node_modules/.bin/vitest",
    ["run", "--configLoader", "runner", "--no-cache"],
    "/workspace/infra/cloudflare/universe-edge",
  ],
  [
    "/workspace/infra/cloudflare/universe-edge/node_modules/.bin/wrangler",
    ["deploy", "--dry-run", "--env=", "--outdir", "/tmp/wrangler-dry-run"],
    "infra/cloudflare/universe-edge",
  ],
];

for (const [command, args, cwd = "/workspace"] of commands) {
  process.stdout.write(`[container-test] ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

process.stdout.write("[container-test] all backend and Worker contracts passed.\n");
