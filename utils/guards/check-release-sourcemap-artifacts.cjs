const fs = require("fs");
const path = require("path");

function assertSafeEntryName(entryName) {
  if (!entryName || entryName === "." || entryName === "..") {
    throw new Error(`Refusing to read unsafe path segment: ${entryName}`);
  }
  if (
    path.posix.basename(entryName) !== entryName ||
    path.win32.basename(entryName) !== entryName
  ) {
    throw new Error(`Refusing to read nested path segment: ${entryName}`);
  }
}

function walkFiles(rootDir) {
  const files = [];
  const items = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const item of items) {
    assertSafeEntryName(item.name);
    const fullPath = `${rootDir}${path.sep}${item.name}`;
    if (item.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (item.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

const configuredDir = String(process.env.SENTRY_DIST_DIR || "dist").trim() || "dist";
const distDir = path.resolve(process.cwd(), configuredDir);

if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
  console.error(
    `[release-sourcemap-artifacts] Bundle artifact directory not found: ${distDir}. ` +
      "Run npm run release:prepare-sentry-artifacts or point SENTRY_DIST_DIR to an exported bundle directory.",
  );
  process.exit(1);
}

const files = walkFiles(distDir);
const sourcemaps = files.filter((filePath) => filePath.endsWith(".map"));
const bundles = files.filter((filePath) => filePath.endsWith(".js") || filePath.endsWith(".hbc"));

if (sourcemaps.length === 0) {
  console.error(
    `[release-sourcemap-artifacts] No sourcemap files were found under ${distDir}. ` +
      "Expo export must be run with source maps enabled before release verification.",
  );
  process.exit(1);
}

if (bundles.length === 0) {
  console.error(
    `[release-sourcemap-artifacts] No bundle or Hermes bytecode files were found under ${distDir}. ` +
      "Release verification requires exported JS bundles alongside the sourcemaps.",
  );
  process.exit(1);
}

console.log(
  `[release-sourcemap-artifacts] OK: found ${bundles.length} bundles and ${sourcemaps.length} sourcemaps in ${distDir}.`,
);
