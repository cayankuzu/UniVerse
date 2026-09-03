const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TOOLING_DOCKERFILE = path.join(ROOT, "infra", "docker", "Dockerfile.tooling");
const READ_REPOSITORY_FILE = /readRepositoryFile\(\s*"([^"]+)"/g;

function fail(message) {
  console.error(`[docker-test-manifest] FAIL: ${message}`);
  process.exit(1);
}

/**
 * The tooling image copies an explicit file list instead of the whole tree, so a contract test
 * that starts reading a new source file passes on the host and fails inside the container. Parse
 * the COPY manifest and require every file the staged tests read to be part of it.
 */
function readCopiedSources(dockerfile) {
  const copied = new Set();
  for (const line of dockerfile.split(/\r?\n/)) {
    const match = /^COPY\s+(?:--[^\s]+\s+)*(.+)$/.exec(line.trim());
    if (!match) continue;
    const operands = match[1].trim().split(/\s+/);
    if (operands.length < 2) continue;
    for (const source of operands.slice(0, -1)) {
      copied.add(source.replaceAll("\\", "/"));
    }
  }
  return copied;
}

const dockerfile = fs.readFileSync(TOOLING_DOCKERFILE, "utf8");
const copiedSources = readCopiedSources(dockerfile);
const stagedTests = [...copiedSources].filter((source) => source.endsWith(".test.mjs")).sort();

if (stagedTests.length === 0) {
  fail("The tooling image copies no contract tests; the container profile would verify nothing.");
}

const missing = [];
for (const testPath of stagedTests) {
  const absoluteTestPath = path.join(ROOT, testPath);
  if (!fs.existsSync(absoluteTestPath)) {
    fail(`Dockerfile.tooling copies ${testPath}, which no longer exists in the repository.`);
  }
  const content = fs.readFileSync(absoluteTestPath, "utf8");
  for (const match of content.matchAll(READ_REPOSITORY_FILE)) {
    const dependency = match[1];
    if (!fs.existsSync(path.join(ROOT, dependency))) {
      fail(`${testPath} reads ${dependency}, which does not exist in the repository.`);
    }
    if (!copiedSources.has(dependency)) {
      missing.push(`${testPath} -> ${dependency}`);
    }
  }
}

if (missing.length > 0) {
  fail(
    "Contract tests staged into the tooling image read files the image never copies:\n- " +
      `${[...new Set(missing)].sort().join("\n- ")}\n` +
      "Add them to the matching COPY line in infra/docker/Dockerfile.tooling.",
  );
}

console.log(
  `[docker-test-manifest] OK: ${stagedTests.length} staged contract tests only read files the tooling image copies.`,
);
