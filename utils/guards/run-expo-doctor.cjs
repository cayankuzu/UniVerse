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

process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
process.exit(typeof result.status === "number" ? result.status : 1);
