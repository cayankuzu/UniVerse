const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, "src", "mobile", "app");
const ONBOARDING_DIR = path.join(ROOT, "src", "mobile", "app", "features", "onboarding");
const EXTS = new Set([".ts", ".tsx"]);
const IGNORED_DIRS = new Set(["node_modules", "dist", "android", "ios", ".expo"]);

const IMPORT_PATTERN = /\bfrom\s*["'][^"']*(mock|demo)[^"']*["']/i;
const REQUIRE_PATTERN = /\brequire\(\s*["'][^"']*(mock|demo)[^"']*["']\s*\)/i;

function walk(dir, collector) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(fullPath, collector);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!EXTS.has(path.extname(entry.name))) continue;
    collector.push(fullPath);
  }
}

const files = [];
walk(TARGET_DIR, files);

const violations = [];
for (const filePath of files) {
  if (filePath.startsWith(ONBOARDING_DIR)) continue;
  const content = fs.readFileSync(filePath, "utf8");
  if (IMPORT_PATTERN.test(content) || REQUIRE_PATTERN.test(content)) {
    violations.push(filePath);
  }
}

if (violations.length > 0) {
  console.error("[mock-guard] Failed: mock/demo import found outside onboarding feature.");
  for (const filePath of violations) {
    console.error(`- ${path.relative(ROOT, filePath)}`);
  }
  process.exit(1);
}

console.log("[mock-guard] OK: onboarding disinda mock/demo import yok.");
