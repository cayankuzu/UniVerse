const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, "src", "mobile");
const MAX_LINES = 500;
const EXTS = new Set([".ts", ".tsx"]);
const IGNORED_DIRS = new Set(["node_modules", "dist", "android", "ios", ".expo"]);

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

function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

const files = [];
walk(TARGET_DIR, files);

const violations = files
  .map((filePath) => ({ filePath, lines: countLines(filePath) }))
  .filter((item) => item.lines > MAX_LINES);

if (violations.length > 0) {
  console.error(`[max-lines] Failed: found ${violations.length} file(s) above ${MAX_LINES} lines.`);
  for (const violation of violations) {
    console.error(`- ${path.relative(ROOT, violation.filePath)} (${violation.lines})`);
  }
  process.exit(1);
}

console.log(`[max-lines] OK: all files are <= ${MAX_LINES} lines.`);
