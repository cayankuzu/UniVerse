#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
const { normalize, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const LCOV_FILE = resolve(ROOT, "coverage", "lcov.info");
const MIN_COVERAGE = Number(process.env.DIFF_COVERAGE_MIN || 90);
const requestedMissLimit = Number(process.env.DIFF_COVERAGE_MAX_MISSES || 40);
const MAX_REPORTED_MISSES =
  Number.isFinite(requestedMissLimit) && requestedMissLimit >= 0
    ? Math.floor(requestedMissLimit)
    : 40;
const SOURCE_PREFIX = normalize("src/mobile/app") + sep;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function runGit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout;
}

function resolveCiBaseRevision() {
  const explicitBase = String(process.env.DIFF_COVERAGE_BASE_SHA || "").trim();
  if (explicitBase && !/^0+$/u.test(explicitBase)) return explicitBase;

  const baseRef = String(process.env.GITHUB_BASE_REF || "").trim();
  if (baseRef) {
    const remoteBase = `refs/remotes/origin/${baseRef}`;
    const mergeBase = runGit(["merge-base", "HEAD", remoteBase]).trim();
    if (mergeBase) return mergeBase;
  }

  const pushBase = String(process.env.GITHUB_EVENT_BEFORE || "").trim();
  if (pushBase && !/^0+$/u.test(pushBase)) return pushBase;
  return "";
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, "/");
}

function extensionOf(file) {
  const index = file.lastIndexOf(".");
  return index >= 0 ? file.slice(index).toLowerCase() : "";
}

function isMobileSourceFile(file) {
  const normalized = normalize(file);
  return (
    normalized.startsWith(SOURCE_PREFIX) &&
    SOURCE_EXTENSIONS.has(extensionOf(file)) &&
    !/\.test\.tsx?$/u.test(file) &&
    !/[/\\]index\.tsx?$/u.test(file)
  );
}

function parseChangedLines(diff) {
  const changed = new Map();
  let currentFile = "";

  for (const line of diff.split(/\r?\n/u)) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length);
      if (!isMobileSourceFile(currentFile)) {
        currentFile = "";
      }
      continue;
    }

    if (!currentFile || !line.startsWith("@@")) {
      continue;
    }

    const match = /\+(\d+)(?:,(\d+))?/u.exec(line);
    if (!match) {
      continue;
    }

    const start = Number(match[1]);
    const count = Number(match[2] || "1");
    if (count <= 0) {
      continue;
    }

    const lines = changed.get(currentFile) || new Set();
    for (let offset = 0; offset < count; offset += 1) {
      lines.add(start + offset);
    }
    changed.set(currentFile, lines);
  }

  return changed;
}

function collectChangedLines() {
  const ciBaseRevision = resolveCiBaseRevision();
  const isCi = /^(1|true)$/iu.test(String(process.env.CI || ""));
  if (isCi && !ciBaseRevision) {
    throw new Error(
      "[diff-coverage] CI base revision is missing. Set DIFF_COVERAGE_BASE_SHA or GITHUB_BASE_REF.",
    );
  }
  const diffs = ciBaseRevision
    ? [
        runGit([
          "diff",
          "--unified=0",
          "--diff-filter=ACMR",
          `${ciBaseRevision}...HEAD`,
          "--",
          "src/mobile/app",
        ]),
      ]
    : [
        runGit(["diff", "--unified=0", "--diff-filter=ACMR", "HEAD", "--", "src/mobile/app"]),
        runGit([
          "diff",
          "--cached",
          "--unified=0",
          "--diff-filter=ACMR",
          "HEAD",
          "--",
          "src/mobile/app",
        ]),
      ];
  const changed = new Map();

  for (const diff of diffs) {
    for (const [file, lines] of parseChangedLines(diff)) {
      const existing = changed.get(file) || new Set();
      for (const line of lines) existing.add(line);
      changed.set(file, existing);
    }
  }

  if (!ciBaseRevision) {
    const untrackedFiles = runGit([
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      "src/mobile/app",
    ])
      .split(/\r?\n/u)
      .filter(isMobileSourceFile);
    for (const file of untrackedFiles) {
      const lineCount = readFileSync(resolve(ROOT, file), "utf8").split(/\r?\n/u).length;
      changed.set(file, new Set(Array.from({ length: lineCount }, (_, index) => index + 1)));
    }
  }

  return changed;
}

function parseLcov() {
  if (!existsSync(LCOV_FILE)) {
    return new Map();
  }

  const coverage = new Map();
  let currentFile = "";

  for (const line of readFileSync(LCOV_FILE, "utf8").split(/\r?\n/u)) {
    if (line.startsWith("SF:")) {
      const sourceFile = line.slice(3);
      const absolute = resolve(ROOT, sourceFile);
      currentFile = normalizePath(relative(ROOT, absolute));
      coverage.set(currentFile, new Map());
      continue;
    }

    if (!currentFile || !line.startsWith("DA:")) {
      continue;
    }

    const [lineNumber, hitCount] = line.slice(3).split(",").map(Number);
    coverage.get(currentFile)?.set(lineNumber, hitCount);
  }

  return coverage;
}

function main() {
  const changedLines = collectChangedLines();
  const totalChanged = [...changedLines.values()].reduce((total, lines) => total + lines.size, 0);

  if (totalChanged === 0) {
    console.log("[diff-coverage] OK: no changed mobile source lines.");
    return;
  }

  if (!existsSync(LCOV_FILE)) {
    console.error(
      "[diff-coverage] coverage/lcov.info is missing. Run npm run test:coverage first.",
    );
    process.exitCode = 1;
    return;
  }

  const coverage = parseLcov();
  let covered = 0;
  let coverable = 0;
  const misses = [];

  for (const [file, lines] of changedLines) {
    const normalizedFile = normalizePath(file);
    const fileCoverage = coverage.get(normalizedFile);
    if (!fileCoverage) {
      for (const line of lines) {
        misses.push(`${normalizedFile}:${line}`);
      }
      coverable += lines.size;
      continue;
    }

    for (const line of lines) {
      if (!fileCoverage.has(line)) {
        continue;
      }
      coverable += 1;
      if ((fileCoverage.get(line) || 0) > 0) {
        covered += 1;
      } else {
        misses.push(`${normalizedFile}:${line}`);
      }
    }
  }

  if (coverable === 0) {
    console.log("[diff-coverage] OK: changed mobile source lines are not coverable in LCOV.");
    return;
  }

  const percent = (covered / coverable) * 100;
  const rounded = percent.toFixed(2);

  if (percent + Number.EPSILON < MIN_COVERAGE) {
    console.error(
      `[diff-coverage] FAILED: ${rounded}% changed-line coverage (${covered}/${coverable}), required ${MIN_COVERAGE}%.`,
    );
    if (misses.length) {
      console.error(
        `[diff-coverage] Uncovered lines:\n${misses.slice(0, MAX_REPORTED_MISSES).join("\n")}`,
      );
      if (misses.length > MAX_REPORTED_MISSES) {
        console.error(`[diff-coverage] ...and ${misses.length - MAX_REPORTED_MISSES} more.`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `[diff-coverage] OK: ${rounded}% changed-line coverage (${covered}/${coverable}), required ${MIN_COVERAGE}%.`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  collectChangedLines,
  isMobileSourceFile,
  parseChangedLines,
  resolveCiBaseRevision,
};
