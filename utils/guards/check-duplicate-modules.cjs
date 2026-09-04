const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SCAN_ROOTS = [
  "src",
  "supabase/functions",
  "utils",
  path.join("infra", "cloudflare", "universe-edge", "src"),
];
const SOURCE_EXTENSION = /\.(ts|tsx|mjs|cjs|js)$/;
const TEST_FILE = /\.(test|spec)\./;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  "artifacts",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);
// Files shorter than this are re-export facades or tiny helpers where an identical body is
// expected and harmless; the defect this guard targets is a copy-pasted implementation.
const MINIMUM_LINES = 15;

function fail(message) {
  console.error(`[duplicate-modules] FAIL: ${message}`);
  process.exit(1);
}

function collectSourceFiles(directory, collected = []) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, collected);
    } else if (SOURCE_EXTENSION.test(entry.name) && !TEST_FILE.test(entry.name)) {
      collected.push(path.relative(ROOT, fullPath).replaceAll("\\", "/"));
    }
  }
  return collected;
}

/**
 * Two modules that differ only by how deeply they reach for the same imports are copies, so
 * collapse relative specifiers to their final segment before comparing.
 */
function normalizeForComparison(source) {
  return source
    .replace(/from\s+"[^"]*\/([^"/]+)"/g, 'from "~/$1"')
    .replace(/require\("[^"]*\/([^"/]+)"\)/g, 'require("~/$1")')
    .replace(/\s+/g, " ")
    .trim();
}

const sourceFiles = SCAN_ROOTS.flatMap((root) => collectSourceFiles(path.join(ROOT, root)));
if (sourceFiles.length === 0) {
  fail("No source files were scanned; the guard would pass vacuously.");
}

const byNormalizedBody = new Map();
for (const file of sourceFiles) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  if (raw.split(/\r?\n/).length < MINIMUM_LINES) continue;
  const key = normalizeForComparison(raw);
  if (!key) continue;
  if (!byNormalizedBody.has(key)) byNormalizedBody.set(key, []);
  byNormalizedBody.get(key).push(file);
}

const duplicates = [...byNormalizedBody.values()]
  .filter((group) => group.length > 1)
  .map((group) => [...group].sort());

if (duplicates.length > 0) {
  const detail = duplicates
    .map((group) => `- ${group.join("\n  ")}`)
    .sort()
    .join("\n");
  fail(
    `Modules duplicate the same implementation:\n${detail}\n` +
      "Keep one owner and let the other module re-export it.",
  );
}

console.log(
  `[duplicate-modules] OK: ${sourceFiles.length} production modules contain no copy-pasted twins.`,
);
