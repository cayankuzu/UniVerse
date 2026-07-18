const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SERVER_ROOT = path.join(ROOT, "supabase", "functions", "server");
const WARN_LINES = 650;
const FAIL_LINES = 1500;
const EXTS = new Set([".ts"]);

function walk(dir, collector) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, collector);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!EXTS.has(path.extname(entry.name))) continue;
    collector.push(fullPath);
  }
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

const files = [];
[
  path.join(SERVER_ROOT, "index.ts"),
  path.join(SERVER_ROOT, "routes"),
  path.join(SERVER_ROOT, "services"),
].forEach((targetPath) => {
  if (!fs.existsSync(targetPath)) return;
  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    walk(targetPath, files);
    return;
  }
  files.push(targetPath);
});

const warnings = [];
const failures = [];

for (const filePath of files) {
  const lineCount = countLines(filePath);
  const relativePath = path.relative(ROOT, filePath);
  if (lineCount > FAIL_LINES) {
    failures.push(`${relativePath} (${lineCount}) exceeds hard architecture limit ${FAIL_LINES}.`);
    continue;
  }
  if (lineCount > WARN_LINES) {
    warnings.push(
      `${relativePath} (${lineCount}) exceeds soft modularization target ${WARN_LINES}.`,
    );
  }
}

if (failures.length > 0) {
  console.error("[server-route-size] FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("[server-route-size] WARN");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
  process.exit(0);
}

console.log(
  "[server-route-size] OK: server route files are within the soft modularization target.",
);
