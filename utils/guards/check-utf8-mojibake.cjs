const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, "src", "mobile", "app");
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json"]);
const IGNORED_DIRS = new Set(["node_modules", "dist", "android", "ios", ".expo"]);
const BAD_PATTERNS = [/Ã./g, /Ä./g, /Å./g, /�/g];

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

function findCorruption(content) {
  for (const pattern of BAD_PATTERNS) {
    if (pattern.test(content)) {
      return pattern.toString();
    }
  }
  return null;
}

const files = [];
walk(TARGET_DIR, files);

const violations = [];
for (const filePath of files) {
  const content = fs.readFileSync(filePath, "utf8");
  const match = findCorruption(content);
  if (match) {
    violations.push({ filePath, match });
  }
}

if (violations.length > 0) {
  console.error(`[utf8-guard] Failed: ${violations.length} file(s) contain mojibake patterns.`);
  for (const violation of violations) {
    console.error(`- ${path.relative(ROOT, violation.filePath)} (${violation.match})`);
  }
  process.exit(1);
}

console.log("[utf8-guard] OK: mojibake patterns not found.");
