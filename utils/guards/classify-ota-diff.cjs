#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");

const CLASSIFICATION = Object.freeze({
  OTA_SAFE: "OTA_SAFE",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
  NATIVE_BUILD_REQUIRED: "NATIVE_BUILD_REQUIRED",
});

const CLASSIFICATION_PRIORITY = Object.freeze({
  [CLASSIFICATION.OTA_SAFE]: 1,
  [CLASSIFICATION.MANUAL_REVIEW_REQUIRED]: 2,
  [CLASSIFICATION.NATIVE_BUILD_REQUIRED]: 3,
});

const NATIVE_EXACT_PATHS = new Set([
  "app.config.cjs",
  "app.config.js",
  "app.config.mjs",
  "app.config.ts",
  "app.json",
  "config/app-release.json",
  "config/ios-prebuild.json",
  "eas.json",
  "expo-module.config.json",
  "gemfile",
  "gemfile.lock",
  "google-services.json",
  "googleservice-info.plist",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "podfile",
  "podfile.lock",
  "react-native.config.cjs",
  "react-native.config.js",
  "react-native.config.mjs",
  "react-native.config.ts",
  "scripts/materialize-native-config.cjs",
  "yarn.lock",
]);

const NATIVE_ROOT_PREFIXES = [
  "android/",
  "config/plugins/",
  "ios/",
  "modules/",
  "native/",
  "patches/",
  "plugins/",
  "expo-plugins/",
];

const OTA_SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/iu;

function normalizeRepoPath(value) {
  if (typeof value !== "string") {
    throw new TypeError("OTA diff paths must be strings.");
  }

  const slashPath = value.replace(/\\/gu, "/");
  if (!slashPath || slashPath.includes("\0")) {
    throw new Error("OTA diff paths must be non-empty and must not contain NUL bytes.");
  }
  if (/^(?:\/|[a-z]:\/|\/\/)/iu.test(slashPath)) {
    throw new Error(`OTA diff paths must be repository-relative: ${value}`);
  }

  const segments = slashPath.split("/").filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`OTA diff path traversal is not allowed: ${value}`);
  }

  const normalized = segments.join("/");
  if (!normalized) {
    throw new Error("OTA diff paths must resolve to a repository file.");
  }
  return normalized;
}

function isNativePath(lowerPath) {
  if (NATIVE_EXACT_PATHS.has(lowerPath)) return true;
  if (NATIVE_ROOT_PREFIXES.some((prefix) => lowerPath.startsWith(prefix))) return true;
  if (lowerPath.startsWith("assets/")) return true;

  const basename = lowerPath.split("/").at(-1) || "";
  if (
    [
      "androidmanifest.xml",
      "expo.plist",
      "google-services.json",
      "googleservice-info.plist",
      "info.plist",
      "privacyinfo.xcprivacy",
      "settings.gradle",
      "settings.gradle.kts",
    ].includes(basename)
  ) {
    return true;
  }

  return /(?:\.cer|\.crt|\.entitlements|\.gradle|\.gradle\.kts|\.mobileprovision|\.p12|\.pbxproj|\.pem|\.plist|\.podspec|\.provisionprofile|\.xcconfig|\.xcprivacy)$/u.test(
    lowerPath,
  );
}

function isMobileRuntimeSource(lowerPath) {
  if (lowerPath === "index.js" || lowerPath === "index.ts") return true;
  if (lowerPath === "src/mobile/main.jsx" || lowerPath === "src/mobile/main.tsx") return true;
  if (!lowerPath.startsWith("src/mobile/app/")) return false;
  return OTA_SOURCE_EXTENSIONS.has(path.posix.extname(lowerPath));
}

function isTestOnlyMobileSource(lowerPath) {
  return (
    /(?:^|\/)__tests__\//u.test(lowerPath) ||
    /\.(?:spec|test)\.(?:js|jsx|ts|tsx)$/u.test(lowerPath) ||
    lowerPath.endsWith(".snap")
  );
}

function isEvidenceOrDocumentation(lowerPath) {
  return (
    lowerPath.startsWith("docs/") ||
    lowerPath.startsWith("quality/") ||
    lowerPath.startsWith("release-evidence/") ||
    lowerPath.startsWith(".maestro/") ||
    /(?:^|\/)readme\.md$/u.test(lowerPath) ||
    /(?:^|\/)agents\.md$/u.test(lowerPath) ||
    /\.md$/u.test(lowerPath)
  );
}

function classifyPath(value) {
  const repoPath = normalizeRepoPath(value);
  const lowerPath = repoPath.toLowerCase();

  if (isNativePath(lowerPath)) {
    return {
      path: repoPath,
      classification: CLASSIFICATION.NATIVE_BUILD_REQUIRED,
      neutral: false,
      otaPayload: false,
      reason:
        "native source, native dependency, native asset, or runtime/build configuration changed",
    };
  }

  if (isMobileRuntimeSource(lowerPath)) {
    const testOnly = isTestOnlyMobileSource(lowerPath);
    return {
      path: repoPath,
      classification: CLASSIFICATION.OTA_SAFE,
      neutral: testOnly,
      otaPayload: !testOnly,
      reason: testOnly
        ? "mobile test/support source does not enter the update payload"
        : "JavaScript/TypeScript mobile source is compatible with the existing native runtime",
    };
  }

  if (isEvidenceOrDocumentation(lowerPath)) {
    return {
      path: repoPath,
      classification: CLASSIFICATION.OTA_SAFE,
      neutral: true,
      otaPayload: false,
      reason:
        "documentation, test, guard, workflow, or immutable evidence does not alter native runtime",
    };
  }

  if (lowerPath.startsWith("supabase/") || lowerPath.startsWith("infra/")) {
    return {
      path: repoPath,
      classification: CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
      neutral: false,
      otaPayload: false,
      reason:
        "backend, database, or infrastructure rollout must be reviewed independently from OTA",
    };
  }

  if (lowerPath.startsWith(".github/workflows/")) {
    return {
      path: repoPath,
      classification: CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
      neutral: false,
      otaPayload: false,
      reason: "release automation outside the guarded EAS Update workflows requires manual review",
    };
  }

  if (
    lowerPath === "babel.config.js" ||
    lowerPath === "metro.config.js" ||
    lowerPath.startsWith("config/") ||
    lowerPath.startsWith("scripts/") ||
    lowerPath.startsWith("utils/") ||
    lowerPath.startsWith("src/") ||
    lowerPath.startsWith(".env")
  ) {
    return {
      path: repoPath,
      classification: CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
      neutral: false,
      otaPayload: false,
      reason:
        "build tooling, environment contract, or non-mobile runtime behavior requires manual review",
    };
  }

  return {
    path: repoPath,
    classification: CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
    neutral: false,
    otaPayload: false,
    reason: "path is not explicitly allowlisted as OTA-safe; fail-closed review is required",
  };
}

function highestClassification(classifications) {
  if (!classifications.length) return CLASSIFICATION.MANUAL_REVIEW_REQUIRED;
  return classifications.reduce((highest, current) =>
    CLASSIFICATION_PRIORITY[current] > CLASSIFICATION_PRIORITY[highest] ? current : highest,
  );
}

function parseNameStatusZ(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value || "");
  if (!text) return [];

  const fields = text.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const records = [];

  for (let index = 0; index < fields.length;) {
    const status = fields[index];
    index += 1;
    if (!/^[acdmrtuxb](?:\d+)?$/iu.test(status)) {
      throw new Error(`Unsupported git name-status token: ${status || "<empty>"}`);
    }

    const pathCount = /^[rc]/iu.test(status) ? 2 : 1;
    if (index + pathCount > fields.length) {
      throw new Error(`Truncated git name-status record for ${status}.`);
    }
    const paths = fields.slice(index, index + pathCount).map(normalizeRepoPath);
    index += pathCount;
    records.push({ status, paths });
  }

  return records;
}

function parseRawDiffZ(value) {
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value || "");
  if (!text) return [];
  const fields = text.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const records = [];

  for (let index = 0; index < fields.length;) {
    const metadata = fields[index];
    index += 1;
    const match = /^:(\d{6}) (\d{6}) ([0-9a-f]{40}) ([0-9a-f]{40}) ([acdmrtuxb](?:\d+)?)$/iu.exec(
      metadata,
    );
    if (!match) throw new Error(`Malformed git raw diff metadata: ${metadata || "<empty>"}`);
    const [, oldMode, newMode, , , status] = match;
    const pathCount = /^[rc]/iu.test(status) ? 2 : 1;
    if (index + pathCount > fields.length) {
      throw new Error(`Truncated git raw diff record for ${status}.`);
    }
    const paths = fields.slice(index, index + pathCount).map(normalizeRepoPath);
    index += pathCount;
    const allowedModes = new Set(["000000", "100644", "100755"]);
    const nonRegularMode = !allowedModes.has(oldMode) || !allowedModes.has(newMode);
    const unexpectedModeChange =
      oldMode !== "000000" && newMode !== "000000" && oldMode !== newMode;
    records.push({
      status,
      paths,
      oldMode,
      newMode,
      requiresManualReview:
        status.toUpperCase().startsWith("T") || nonRegularMode || unexpectedModeChange,
      modeReason:
        status.toUpperCase().startsWith("T") || nonRegularMode
          ? "git type, symlink, or submodule changes require manual review"
          : unexpectedModeChange
            ? "git executable/mode changes require manual review"
            : "",
    });
  }
  return records;
}

function classifyChangedRecords(records) {
  const filesByPath = new Map();
  const classifiedRecords = records.map((record) => {
    if (!record || !Array.isArray(record.paths) || record.paths.length === 0) {
      throw new Error("Every OTA diff record must contain at least one path.");
    }
    const files = record.paths.map((repoPath) => {
      const classified = classifyPath(repoPath);
      if (record.requiresManualReview && classified.classification === CLASSIFICATION.OTA_SAFE) {
        return {
          ...classified,
          classification: CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
          neutral: false,
          otaPayload: false,
          reason: record.modeReason,
        };
      }
      return classified;
    });
    for (const file of files) filesByPath.set(file.path, file);
    return {
      status: String(record.status || "").toUpperCase(),
      paths: files.map((file) => file.path),
      classification: highestClassification(files.map((file) => file.classification)),
    };
  });

  const files = [...filesByPath.values()].sort((left, right) =>
    left.path.localeCompare(right.path, "en"),
  );
  const counts = {
    [CLASSIFICATION.OTA_SAFE]: 0,
    [CLASSIFICATION.MANUAL_REVIEW_REQUIRED]: 0,
    [CLASSIFICATION.NATIVE_BUILD_REQUIRED]: 0,
  };
  for (const file of files) counts[file.classification] += 1;

  const nonNeutralFiles = files.filter((file) => !file.neutral);
  return {
    classification:
      nonNeutralFiles.length === 0
        ? CLASSIFICATION.MANUAL_REVIEW_REQUIRED
        : highestClassification(nonNeutralFiles.map((file) => file.classification)),
    hasOtaPayload: files.some((file) => file.otaPayload),
    counts,
    records: classifiedRecords,
    files,
  };
}

function runGit(repoRoot, args, acceptedStatuses = [0]) {
  const result = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!acceptedStatuses.includes(result.status)) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8").trim()
      : String(result.stderr || "").trim();
    throw new Error(`git ${args.join(" ")} failed${stderr ? `: ${stderr}` : "."}`);
  }
  return result;
}

function assertFullSha(value, label) {
  const sha = String(value || "")
    .trim()
    .toLowerCase();
  if (!FULL_SHA_PATTERN.test(sha)) {
    throw new Error(`${label} must be a full 40-character commit SHA.`);
  }
  return sha;
}

function resolveCommitSha(repoRoot, value, label = "commit SHA") {
  const requested = assertFullSha(value, label);
  const result = runGit(repoRoot, ["rev-parse", "--verify", `${requested}^{commit}`]);
  const resolved = result.stdout.toString("utf8").trim().toLowerCase();
  if (resolved !== requested) {
    throw new Error(`${label} did not resolve immutably to itself.`);
  }
  return resolved;
}

function collectGitDiff({ repoRoot = process.cwd(), baseSha, headSha, requireClean = false }) {
  const root = path.resolve(repoRoot);
  const base = resolveCommitSha(root, baseSha, "base SHA");
  const head = resolveCommitSha(root, headSha, "head SHA");
  const headTreeSha = runGit(root, ["rev-parse", `${head}^{tree}`])
    .stdout.toString("utf8")
    .trim()
    .toLowerCase();
  const checkedOutHead = runGit(root, ["rev-parse", "HEAD"])
    .stdout.toString("utf8")
    .trim()
    .toLowerCase();
  if (checkedOutHead !== head) {
    throw new Error(
      `Checked-out HEAD ${checkedOutHead} does not match requested head SHA ${head}.`,
    );
  }

  const ancestorResult = runGit(root, ["merge-base", "--is-ancestor", base, head], [0, 1]);
  if (ancestorResult.status !== 0) {
    throw new Error(`Base SHA ${base} is not an ancestor of head SHA ${head}.`);
  }

  if (requireClean) {
    const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=no"])
      .stdout.toString("utf8")
      .trim();
    if (status) {
      throw new Error("Tracked working tree changes are not valid immutable OTA evidence.");
    }
  }

  const diff = runGit(root, [
    "diff",
    "--raw",
    "--no-abbrev",
    "-z",
    "--find-renames=50%",
    "--find-copies=50%",
    base,
    head,
    "--",
  ]).stdout;
  const classified = classifyChangedRecords(parseRawDiffZ(diff));

  return {
    schemaVersion: 1,
    policySha256: createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
    baseSha: base,
    headSha: head,
    headTreeSha,
    ...classified,
  };
}

function parseArguments(args) {
  const options = {
    baseSha: process.env.OTA_DIFF_BASE_SHA || "",
    headSha: process.env.OTA_DIFF_HEAD_SHA || "",
    githubOutput: "",
    jsonOutput: "",
    requireClean: false,
    requireOtaPayload: false,
    requireOtaSafe: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const takeValue = () => {
      index += 1;
      if (index >= args.length || args[index].startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      return args[index];
    };

    if (argument === "--base") options.baseSha = takeValue();
    else if (argument === "--head") options.headSha = takeValue();
    else if (argument === "--github-output") options.githubOutput = takeValue();
    else if (argument === "--json-output") options.jsonOutput = takeValue();
    else if (argument === "--require-clean") options.requireClean = true;
    else if (argument === "--require-ota-payload") options.requireOtaPayload = true;
    else if (argument === "--require-ota-safe") options.requireOtaSafe = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown OTA classifier argument: ${argument}`);
  }
  return options;
}

function writeJson(filePath, value) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendGithubOutput(filePath, report) {
  const output = [
    `classification=${report.classification}`,
    `has_ota_payload=${String(report.hasOtaPayload)}`,
    `change_count=${String(report.files.length)}`,
    `ota_safe_count=${String(report.counts[CLASSIFICATION.OTA_SAFE])}`,
    `manual_review_count=${String(report.counts[CLASSIFICATION.MANUAL_REVIEW_REQUIRED])}`,
    `native_build_count=${String(report.counts[CLASSIFICATION.NATIVE_BUILD_REQUIRED])}`,
    `base_sha=${report.baseSha}`,
    `head_sha=${report.headSha}`,
  ].join("\n");
  fs.appendFileSync(path.resolve(filePath), `${output}\n`, "utf8");
}

function printHelp() {
  console.log(`Usage: node utils/guards/classify-ota-diff.cjs --base <full-sha> --head <full-sha> [options]

Options:
  --json-output <path>       Write the deterministic classifier report.
  --github-output <path>     Append scalar outputs for GitHub Actions.
  --require-clean            Reject tracked working-tree changes.
  --require-ota-safe         Exit 2 unless the overall result is OTA_SAFE.
  --require-ota-payload      Exit 2 unless at least one runtime source/asset changed.
`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const report = collectGitDiff({
    baseSha: options.baseSha,
    headSha: options.headSha,
    requireClean: options.requireClean,
  });
  if (options.jsonOutput) writeJson(options.jsonOutput, report);
  if (options.githubOutput) appendGithubOutput(options.githubOutput, report);

  console.log(
    `[ota-diff] ${report.classification}: ${report.files.length} changed path(s); OTA payload=${report.hasOtaPayload}.`,
  );
  for (const file of report.files.filter(
    (entry) => entry.classification !== CLASSIFICATION.OTA_SAFE,
  )) {
    console.error(`[ota-diff] ${file.classification}: ${file.path} (${file.reason})`);
  }

  if (options.requireOtaSafe && report.classification !== CLASSIFICATION.OTA_SAFE) {
    console.error("[ota-diff] BLOCKED: the diff is not fully OTA_SAFE.");
    process.exitCode = 2;
  }
  if (options.requireOtaPayload && !report.hasOtaPayload) {
    console.error("[ota-diff] BLOCKED: the diff contains no OTA runtime payload.");
    process.exitCode = 2;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[ota-diff] FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  CLASSIFICATION,
  assertFullSha,
  classifyChangedRecords,
  classifyPath,
  collectGitDiff,
  highestClassification,
  normalizeRepoPath,
  parseArguments,
  parseNameStatusZ,
  parseRawDiffZ,
  resolveCommitSha,
};
