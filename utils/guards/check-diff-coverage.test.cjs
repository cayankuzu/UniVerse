const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const {
  isMobileSourceFile,
  parseChangedLines,
  resolveCiBaseRevision,
} = require("./check-diff-coverage.cjs");

const originalBaseSha = process.env.DIFF_COVERAGE_BASE_SHA;

afterEach(() => {
  if (originalBaseSha === undefined) delete process.env.DIFF_COVERAGE_BASE_SHA;
  else process.env.DIFF_COVERAGE_BASE_SHA = originalBaseSha;
});

test("parses committed PR changes from a base-to-head diff fixture", () => {
  const changed = parseChangedLines(
    [
      "diff --git a/src/mobile/app/example.ts b/src/mobile/app/example.ts",
      "--- a/src/mobile/app/example.ts",
      "+++ b/src/mobile/app/example.ts",
      "@@ -10,0 +11,3 @@",
      "+const one = 1;",
      "+const two = 2;",
      "+const three = 3;",
    ].join("\n"),
  );

  assert.deepEqual([...changed.get("src/mobile/app/example.ts")], [11, 12, 13]);
});

test("uses the explicit PR base SHA instead of a clean working-tree diff", () => {
  process.env.DIFF_COVERAGE_BASE_SHA = "abc123";
  assert.equal(resolveCiBaseRevision(), "abc123");
});

test("excludes tests and barrel files from changed production coverage", () => {
  assert.equal(isMobileSourceFile("src/mobile/app/feature.ts"), true);
  assert.equal(isMobileSourceFile("src/mobile/app/feature.test.ts"), false);
  assert.equal(isMobileSourceFile("src/mobile/app/index.ts"), false);
});
