const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const outputDir = String(process.env.SENTRY_DIST_DIR || "dist").trim() || "dist";
const args = [
  "exec",
  "--yes",
  "--",
  "expo",
  "export",
  "--output-dir",
  outputDir,
  "--source-maps",
  "external",
  "--platform",
  "all",
];

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
  console.error(
    "[release-sentry-artifacts] Unable to locate npm-cli.js in the current environment.",
  );
  process.exit(1);
}

console.log(
  `[release-sentry-artifacts] running: node ${path.basename(npmCliPath)} ${args.join(" ")}`,
);

const result = spawnSync(process.execPath, [npmCliPath, ...args], {
  encoding: "utf8",
  shell: false,
  stdio: "inherit",
});

if (!result || result.status !== 0) {
  process.exit(result.status || 1);
}
