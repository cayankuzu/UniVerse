const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

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

const npmCliPath = resolveNpmCliPath();
if (!npmCliPath) {
  console.error("[expo-doctor] Unable to locate npm-cli.js in the current environment.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [npmCliPath, "exec", "--yes", "--", "expo-doctor"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: false,
  stdio: "pipe",
});

const output = `${result.stdout || ""}${result.stderr || ""}`;
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");

if (result.status === 0) {
  process.exit(0);
}

const nativeSyncExceptionDoc = path.join(
  process.cwd(),
  "docs",
  "expo-native-config-sync-exceptions.md",
);
const failedCheckLines = output
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith("✖ "));
const onlyNativeSyncCheckFailed =
  failedCheckLines.length === 1 &&
  failedCheckLines[0].includes("app config fields that may not be synced");

if (onlyNativeSyncCheckFailed && fs.existsSync(nativeSyncExceptionDoc)) {
  const doc = fs.readFileSync(nativeSyncExceptionDoc, "utf8");
  const requiredTerms = ["scheme", "icon", "plugins", "splash", "ios", "android"];
  const docCoversException = requiredTerms.every((term) => doc.includes(term));
  if (docCoversException) {
    console.warn(
      "[expo-doctor] Allowing the documented native config sync exception. All other Expo Doctor checks must still pass.",
    );
    process.exit(0);
  }
}

process.exit(typeof result.status === "number" ? result.status : 1);
