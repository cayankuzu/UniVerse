const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGETS = [
  path.join(ROOT, "src", "mobile", "app"),
  path.join(ROOT, "supabase", "functions", "server"),
];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const DISALLOWED_PATTERNS = [
  { label: "console.log", pattern: /\bconsole\.log\s*\(/g },
  { label: "TODO", pattern: /\bTODO\b/g },
  { label: "FIXME", pattern: /\bFIXME\b/g },
  { label: "HACK", pattern: /\bHACK\b/g },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const failures = [];
for (const target of TARGETS) {
  for (const filePath of walk(target)) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const { label, pattern } of DISALLOWED_PATTERNS) {
      pattern.lastIndex = 0;
      if (!pattern.test(content)) continue;
      failures.push(`${path.relative(ROOT, filePath)} contains disallowed ${label}.`);
    }
  }
}

if (failures.length > 0) {
  console.error("[runtime-hygiene] FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "[runtime-hygiene] OK: runtime source tree has no console.log/TODO/FIXME/HACK markers.",
);
