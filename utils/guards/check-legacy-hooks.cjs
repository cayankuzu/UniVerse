const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const LEGACY_FILES = [
  path.join(ROOT, "src", "mobile", "app", "hooks", "useGoBack.ts"),
  path.join(ROOT, "src", "mobile", "app", "hooks", "useScrollHide.ts"),
];
const SHARED_HOOKS_DIR = path.join(ROOT, "src", "mobile", "app", "shared", "hooks");
const PASSTHROUGH_RE = /^export\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?\s*$/m;

const failures = [];

for (const filePath of LEGACY_FILES) {
  if (fs.existsSync(filePath)) {
    failures.push(`legacy duplicate hook still exists: ${path.relative(ROOT, filePath)}`);
  }
}

if (fs.existsSync(SHARED_HOOKS_DIR)) {
  for (const entry of fs.readdirSync(SHARED_HOOKS_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(SHARED_HOOKS_DIR, entry.name);
    const content = fs.readFileSync(fullPath, "utf8").trim();
    const normalized = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const isPassthrough =
      normalized.length > 0 &&
      normalized.every((line) => PASSTHROUGH_RE.test(line)) &&
      normalized.some((line) => line.includes("hooks/"));
    if (isPassthrough) {
      failures.push(
        `shared hook is only a passthrough re-export: ${path.relative(ROOT, fullPath)}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("[legacy-hooks] Failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[legacy-hooks] OK: no duplicate legacy hook passthroughs found.");
