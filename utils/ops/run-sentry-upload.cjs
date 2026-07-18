const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolveSentryCliExecutable() {
  if (String(process.env.SENTRY_CLI_EXECUTABLE || "").trim()) {
    return String(process.env.SENTRY_CLI_EXECUTABLE).trim();
  }

  try {
    const { SentryCli } = require("@sentry/cli");
    return SentryCli.getPath();
  } catch {
    return "";
  }
}

const outputDir = String(process.env.SENTRY_DIST_DIR || "dist").trim() || "dist";
const CHILD_ENV = {
  ...process.env,
  SENTRY_CLI_EXECUTABLE: resolveSentryCliExecutable(),
  SENTRY_URL: String(process.env.SENTRY_URL || "https://sentry.io/").trim() || "https://sentry.io/",
};
const NODE_CANDIDATES = [process.execPath];

function resolveNpmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

let nodeScriptResult = null;
for (const candidate of NODE_CANDIDATES) {
  const nextResult = spawnSync(candidate, ["./utils/guards/check-release-sentry-env.cjs"], {
    encoding: "utf8",
    shell: false,
    stdio: "inherit",
    env: CHILD_ENV,
  });
  if (nextResult.error && nextResult.error.code === "ENOENT") {
    continue;
  }
  nodeScriptResult = nextResult;
  break;
}
if (!nodeScriptResult || nodeScriptResult.status !== 0) {
  process.exit(nodeScriptResult ? nodeScriptResult.status || 1 : 1);
}

nodeScriptResult = null;
for (const candidate of NODE_CANDIDATES) {
  const nextResult = spawnSync(
    candidate,
    ["./utils/guards/check-release-sourcemap-artifacts.cjs"],
    {
      encoding: "utf8",
      shell: false,
      stdio: "inherit",
      env: CHILD_ENV,
    },
  );
  if (nextResult.error && nextResult.error.code === "ENOENT") {
    continue;
  }
  nodeScriptResult = nextResult;
  break;
}
if (!nodeScriptResult || nodeScriptResult.status !== 0) {
  process.exit(nodeScriptResult ? nodeScriptResult.status || 1 : 1);
}

console.log(`[release-sentry-upload] uploading Expo bundles and sourcemaps from ${outputDir}`);
const npmCliPath = resolveNpmCliPath();
if (!npmCliPath) {
  console.error("[release-sentry-upload] Unable to locate npm-cli.js in the current environment.");
  process.exit(1);
}
const uploadResult = spawnSync(
  process.execPath,
  [npmCliPath, "exec", "--yes", "--", "sentry-expo-upload-sourcemaps", outputDir],
  {
    encoding: "utf8",
    shell: false,
    stdio: "inherit",
    env: CHILD_ENV,
  },
);
if (!uploadResult || uploadResult.status !== 0) {
  process.exit(uploadResult ? uploadResult.status || 1 : 1);
}
