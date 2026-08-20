const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MOBILE_ROOT = fs.realpathSync.native(path.join(ROOT, "src", "mobile"));
const failures = [];

function resolveContainedChild(directory, entryName) {
  if (entryName !== path.basename(entryName) || entryName === "." || entryName === "..") {
    throw new Error(`[deterministic-tests] Unsafe directory entry: ${entryName}`);
  }

  const candidate = fs.realpathSync.native(`${directory}${path.sep}${entryName}`);
  const relative = path.relative(MOBILE_ROOT, candidate);
  const escapesRoot =
    relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);

  if (escapesRoot) {
    throw new Error(`[deterministic-tests] Directory entry escapes mobile root: ${entryName}`);
  }

  return candidate;
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = resolveContainedChild(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !/[.]test[.]tsx?$/.test(entry.name)) continue;

    const source = fs.readFileSync(fullPath, "utf8");
    const readsLiveClock = /Date[.]now\(\)|new Date\(\)/.test(source);
    if (readsLiveClock && !/jest[.]setSystemTime\(/.test(source)) {
      failures.push(
        `${path.relative(ROOT, fullPath)} reads the live clock without jest.setSystemTime().`,
      );
    }
  }
}

walk(MOBILE_ROOT);

if (failures.length > 0) {
  console.error(`[deterministic-tests] FAIL: ${failures.length} live-clock test(s).`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("[deterministic-tests] OK: live-clock tests use a fixed system time.");
