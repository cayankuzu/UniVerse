const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { afterEach, test } = require("node:test");
const {
  CLASSIFICATION,
  assertFullSha,
  classifyChangedRecords,
  classifyPath,
  collectGitDiff,
  normalizeRepoPath,
  parseArguments,
  parseNameStatusZ,
  parseRawDiffZ,
} = require("./classify-ota-diff.cjs");

const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop(), { force: true, recursive: true });
  }
});

function expectClassification(repoPath, expected, otaPayload = false) {
  const result = classifyPath(repoPath);
  assert.equal(result.classification, expected, repoPath);
  assert.equal(result.otaPayload, otaPayload, `${repoPath} payload flag`);
}

function git(repoRoot, ...args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_EMAIL: "ota-test@example.invalid",
      GIT_AUTHOR_NAME: "OTA Test",
      GIT_COMMITTER_EMAIL: "ota-test@example.invalid",
      GIT_COMMITTER_NAME: "OTA Test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createGitFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "universe-ota-diff-"));
  temporaryDirectories.push(repoRoot);
  git(repoRoot, "init", "--quiet");
  fs.writeFileSync(path.join(repoRoot, "README.md"), "base\n", "utf8");
  git(repoRoot, "add", "README.md");
  git(repoRoot, "commit", "--quiet", "-m", "base");
  const baseSha = git(repoRoot, "rev-parse", "HEAD");

  fs.mkdirSync(path.join(repoRoot, "src", "mobile", "app"), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, "src", "mobile", "app", "example.ts"),
    "export const example = true;\n",
    "utf8",
  );
  git(repoRoot, "add", "src/mobile/app/example.ts");
  git(repoRoot, "commit", "--quiet", "-m", "mobile change");
  const headSha = git(repoRoot, "rev-parse", "HEAD");
  return { baseSha, headSha, repoRoot };
}

test("normalizes repository paths without weakening traversal checks", () => {
  assert.equal(normalizeRepoPath("./src\\mobile\\app\\screen.tsx"), "src/mobile/app/screen.tsx");
  assert.throws(() => normalizeRepoPath("../android/app/build.gradle"), /traversal/u);
  assert.throws(() => normalizeRepoPath("C:\\repo\\app.json"), /repository-relative/u);
  assert.throws(() => normalizeRepoPath(""), /non-empty/u);
});

test("classifies JavaScript and TypeScript mobile payloads as OTA safe", () => {
  expectClassification("index.ts", CLASSIFICATION.OTA_SAFE, true);
  expectClassification("src/mobile/app/features/feed/feed.tsx", CLASSIFICATION.OTA_SAFE, true);
  expectClassification(
    "src/mobile/app/platform/config/runtime.json",
    CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
    false,
  );
  expectClassification(
    "src/mobile/app/features/feed/feed.test.tsx",
    CLASSIFICATION.OTA_SAFE,
    false,
  );
});

test("treats every current asset path as native until a separately reviewed asset policy exists", () => {
  expectClassification(
    "assets/runtime/feed-empty.webp",
    CLASSIFICATION.NATIVE_BUILD_REQUIRED,
    false,
  );
  expectClassification("assets/new-icon.png", CLASSIFICATION.NATIVE_BUILD_REQUIRED, false);
});

test("forces a native build for native trees, dependencies, config, permissions, and native assets", () => {
  const nativePaths = [
    "android/app/src/main/AndroidManifest.xml",
    "ios/UniVerse/Expo.plist",
    "package.json",
    "package-lock.json",
    "app.config.js",
    "app.json",
    "eas.json",
    "config/app-release.json",
    "config/ios-prebuild.json",
    "plugins/with-permission.js",
    "patches/react-native.patch",
    "scripts/materialize-native-config.cjs",
    "assets/notifications/android-notification-icon.png",
    "assets/splash/brand-screen.png",
    "some/Config.entitlements",
    "certs/update-certificate.pem",
    "firebase/GoogleService-Info.plist",
    "some/PrivacyInfo.xcprivacy",
  ];
  for (const repoPath of nativePaths) {
    expectClassification(repoPath, CLASSIFICATION.NATIVE_BUILD_REQUIRED, false);
  }
});

test("fails closed for backend, database, infrastructure, environment, and unknown paths", () => {
  const manualPaths = [
    "supabase/migrations/20260830000000_change.sql",
    "infra/cloudflare/worker.ts",
    ".github/workflows/release-verify.yml",
    ".env.example",
    "babel.config.js",
    "scripts/release.cjs",
    "src/server/index.ts",
  ];
  for (const repoPath of manualPaths) {
    expectClassification(repoPath, CLASSIFICATION.MANUAL_REVIEW_REQUIRED, false);
  }
});

test("treats documentation and evidence as neutral but policy and workflow changes as manual", () => {
  const neutralPaths = [
    "docs/ota-runtime-and-release.md",
    "release-evidence/ota/manifest.json",
    "quality/feature-surface.snapshot.json",
  ];
  for (const repoPath of neutralPaths) {
    expectClassification(repoPath, CLASSIFICATION.OTA_SAFE, false);
  }
  expectClassification(
    "utils/guards/classify-ota-diff.cjs",
    CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
    false,
  );
  expectClassification(
    ".github/workflows/eas-update-preview.yml",
    CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
    false,
  );
  assert.equal(
    classifyChangedRecords([{ status: "M", paths: ["docs/ota-runtime-and-release.md"] }])
      .classification,
    CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
  );
});

test("parses NUL-delimited git records including rename paths with whitespace", () => {
  const records = parseNameStatusZ(
    Buffer.from("M\0src/mobile/app/a.ts\0R100\0src/mobile/app/old name.ts\0android/new name.kt\0"),
  );
  assert.deepEqual(records, [
    { status: "M", paths: ["src/mobile/app/a.ts"] },
    { status: "R100", paths: ["src/mobile/app/old name.ts", "android/new name.kt"] },
  ]);
});

test("rejects malformed or truncated git name-status data", () => {
  assert.throws(() => parseNameStatusZ("Z\0file.ts\0"), /Unsupported/u);
  assert.throws(() => parseNameStatusZ("R100\0only-old.ts\0"), /Truncated/u);
});

test("parses raw diffs and marks type, symlink, submodule, and mode changes for review", () => {
  const zero = "0".repeat(40);
  const one = "1".repeat(40);
  const records = parseRawDiffZ(
    [
      `:100644 100644 ${zero} ${one} M`,
      "src/mobile/app/safe.ts",
      `:100644 100755 ${zero} ${one} M`,
      "src/mobile/app/mode.ts",
      `:120000 120000 ${zero} ${one} M`,
      "src/mobile/app/link.ts",
      "",
    ].join("\0"),
  );
  assert.equal(records[0].requiresManualReview, false);
  assert.equal(records[1].requiresManualReview, true);
  assert.equal(records[2].requiresManualReview, true);
  assert.equal(
    classifyChangedRecords(records).classification,
    CLASSIFICATION.MANUAL_REVIEW_REQUIRED,
  );
  assert.throws(() => parseRawDiffZ(":bad\0file\0"), /Malformed/u);
});

test("uses the strictest classification across mixed changes and both sides of a rename", () => {
  const result = classifyChangedRecords([
    { status: "M", paths: ["src/mobile/app/a.ts"] },
    { status: "M", paths: ["supabase/functions/server/index.ts"] },
    { status: "R100", paths: ["src/mobile/app/old.ts", "android/app/New.kt"] },
  ]);
  assert.equal(result.classification, CLASSIFICATION.NATIVE_BUILD_REQUIRED);
  assert.equal(result.hasOtaPayload, true);
  assert.deepEqual(result.counts, {
    OTA_SAFE: 2,
    MANUAL_REVIEW_REQUIRED: 1,
    NATIVE_BUILD_REQUIRED: 1,
  });
});

test("empty diffs are review-required and never count as an OTA payload", () => {
  const result = classifyChangedRecords([]);
  assert.equal(result.classification, CLASSIFICATION.MANUAL_REVIEW_REQUIRED);
  assert.equal(result.hasOtaPayload, false);
  assert.deepEqual(result.files, []);
});

test("requires immutable full commit SHAs and rejects ambiguous revisions", () => {
  assert.equal(assertFullSha("A".repeat(40), "test SHA"), "a".repeat(40));
  assert.throws(() => assertFullSha("HEAD", "test SHA"), /full 40-character/u);
  assert.throws(() => assertFullSha("a".repeat(39), "test SHA"), /full 40-character/u);
});

test("parses workflow flags and rejects unknown or missing options", () => {
  const options = parseArguments([
    "--base",
    "a".repeat(40),
    "--head",
    "b".repeat(40),
    "--require-clean",
    "--require-ota-safe",
    "--require-ota-payload",
  ]);
  assert.equal(options.baseSha, "a".repeat(40));
  assert.equal(options.requireClean, true);
  assert.equal(options.requireOtaSafe, true);
  assert.equal(options.requireOtaPayload, true);
  assert.throws(() => parseArguments(["--base"]), /requires a value/u);
  assert.throws(() => parseArguments(["--unknown"]), /Unknown/u);
});

test("classifies an immutable committed git range and rejects a dirty evidence tree", () => {
  const fixture = createGitFixture();
  const report = collectGitDiff({ ...fixture, requireClean: true });
  assert.equal(report.baseSha, fixture.baseSha);
  assert.equal(report.headSha, fixture.headSha);
  assert.match(report.headTreeSha, /^[0-9a-f]{40}$/u);
  assert.equal(report.classification, CLASSIFICATION.OTA_SAFE);
  assert.equal(report.hasOtaPayload, true);
  assert.match(report.policySha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(
    report.files.map((file) => file.path),
    ["src/mobile/app/example.ts"],
  );

  fs.appendFileSync(path.join(fixture.repoRoot, "src", "mobile", "app", "example.ts"), "dirty\n");
  assert.throws(
    () => collectGitDiff({ ...fixture, requireClean: true }),
    /Tracked working tree changes/u,
  );
});

test("rejects a base commit that is not an ancestor of the candidate", () => {
  const fixture = createGitFixture();
  git(fixture.repoRoot, "checkout", "--quiet", "--orphan", "unrelated");
  git(fixture.repoRoot, "rm", "-rf", "--quiet", ".");
  fs.writeFileSync(path.join(fixture.repoRoot, "unrelated.txt"), "unrelated\n", "utf8");
  git(fixture.repoRoot, "add", "unrelated.txt");
  git(fixture.repoRoot, "commit", "--quiet", "-m", "unrelated");
  const unrelatedHead = git(fixture.repoRoot, "rev-parse", "HEAD");

  assert.throws(
    () =>
      collectGitDiff({
        repoRoot: fixture.repoRoot,
        baseSha: fixture.headSha,
        headSha: unrelatedHead,
      }),
    /is not an ancestor/u,
  );
});
