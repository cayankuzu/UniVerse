const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const YAML = require("yaml");
const {
  GITHUB_ACTIONS_APP_ID,
  REQUIRED_CHECK_NAMES,
  parseArguments,
  validateRequiredChecks,
} = require("./validate-github-required-checks.cjs");

const CANDIDATE_SHA = "1234567890abcdef1234567890abcdef12345678";
const ROOT = path.resolve(__dirname, "..", "..");

function passingRun(name, overrides = {}) {
  return {
    app: { id: GITHUB_ACTIONS_APP_ID },
    conclusion: "success",
    head_sha: CANDIDATE_SHA,
    name,
    status: "completed",
    ...overrides,
  };
}

function response(overrides = {}) {
  const checkRuns = REQUIRED_CHECK_NAMES.map((name) => passingRun(name));
  return {
    check_runs: checkRuns,
    total_count: checkRuns.length,
    ...overrides,
  };
}

test("accepts exactly one successful same-SHA GitHub Actions run for every required name", () => {
  const result = validateRequiredChecks(JSON.stringify(response()), CANDIDATE_SHA);
  assert.equal(result.candidateSha, CANDIDATE_SHA);
  assert.equal(result.expectedCheckCount, REQUIRED_CHECK_NAMES.length);
  assert.deepEqual(Object.keys(result.checks), REQUIRED_CHECK_NAMES);
});

test("rejects malformed JSON and a non-full candidate SHA", () => {
  assert.throws(() => validateRequiredChecks("{", CANDIDATE_SHA), /not valid JSON/u);
  assert.throws(() => validateRequiredChecks(response(), "abc"), /40-character commit SHA/u);
  assert.throws(
    () => validateRequiredChecks(response(), CANDIDATE_SHA.toUpperCase()),
    /40-character commit SHA/u,
  );
});

test("rejects a missing required check name", () => {
  const missing = response();
  missing.check_runs.pop();
  missing.total_count -= 1;
  assert.throws(() => validateRequiredChecks(missing, CANDIDATE_SHA), /required check is missing/u);
});

// A branch that is both pushed to and open as a pull request runs the same
// workflow twice, so one name legitimately appears more than once on a SHA.
test("accepts a duplicated required check name when every run agrees", () => {
  const duplicate = response();
  duplicate.check_runs.push(passingRun(REQUIRED_CHECK_NAMES[0]));
  duplicate.total_count += 1;

  const result = validateRequiredChecks(duplicate, CANDIDATE_SHA);
  assert.equal(result.checks[REQUIRED_CHECK_NAMES[0]].runCount, 2);
  assert.equal(result.checks[REQUIRED_CHECK_NAMES[1]].runCount, 1);
});

test("rejects a duplicated required check name when one of its runs failed", () => {
  const disagreeing = response();
  disagreeing.check_runs.push(passingRun(REQUIRED_CHECK_NAMES[0], { conclusion: "failure" }));
  disagreeing.total_count += 1;
  assert.throws(
    () => validateRequiredChecks(disagreeing, CANDIDATE_SHA),
    /not completed successfully/u,
  );

  const stillRunning = response();
  stillRunning.check_runs.push(
    passingRun(REQUIRED_CHECK_NAMES[0], { conclusion: null, status: "in_progress" }),
  );
  stillRunning.total_count += 1;
  assert.throws(
    () => validateRequiredChecks(stillRunning, CANDIDATE_SHA),
    /not completed successfully/u,
  );
});

test("rejects a wrong SHA, app, status, or conclusion", () => {
  for (const [overrides, pattern] of [
    [{ head_sha: "a".repeat(40) }, /head_sha mismatch/u],
    [{ app: { id: 1 } }, /GitHub Actions app/u],
    [{ status: "in_progress", conclusion: null }, /not completed successfully/u],
    [{ conclusion: "failure" }, /not completed successfully/u],
  ]) {
    const value = response();
    value.check_runs[0] = passingRun(REQUIRED_CHECK_NAMES[0], overrides);
    assert.throws(() => validateRequiredChecks(value, CANDIDATE_SHA), pattern);
  }
});

test("rejects pagination, truncation, and inconsistent counts", () => {
  assert.throws(
    () => validateRequiredChecks([response()], CANDIDATE_SHA),
    /not a paginated page array/u,
  );
  assert.throws(
    () => validateRequiredChecks(response({ total_count: 101 }), CANDIDATE_SHA),
    /requires pagination/u,
  );
  assert.throws(
    () => validateRequiredChecks(response({ total_count: 5 }), CANDIDATE_SHA),
    /truncated or has an inconsistent total_count/u,
  );
  assert.throws(
    () => validateRequiredChecks(response({ incomplete_results: true }), CANDIDATE_SHA),
    /pagination or truncation/u,
  );
  assert.throws(
    () => validateRequiredChecks(response({ next: "page-2" }), CANDIDATE_SHA),
    /pagination or truncation/u,
  );
});

test("rejects malformed response envelopes", () => {
  for (const value of [null, [], {}, { check_runs: [], total_count: -1 }]) {
    assert.throws(() => validateRequiredChecks(value, CANDIDATE_SHA));
  }
});

test("CLI parser rejects unknown, missing-value, and duplicate arguments", () => {
  assert.deepEqual(parseArguments(["--candidate", CANDIDATE_SHA, "--input", "checks.json"]), {
    "--candidate": CANDIDATE_SHA,
    "--input": "checks.json",
  });
  assert.throws(() => parseArguments(["--other", "x"]), /unexpected argument/u);
  assert.throws(() => parseArguments(["--candidate"]), /requires a value/u);
  assert.throws(() => parseArguments(["--input", "a", "--input", "b"]), /duplicate argument/u);
});

test("production provider workflows depend on a credential-free same-SHA check gate", () => {
  for (const [relativePath, verifyJobName, providerJobName] of [
    [".github/workflows/cloudflare-production.yml", "verify_candidate", "production"],
    [".github/workflows/eas-update-production.yml", "verify-production", "publish-production"],
  ]) {
    const workflow = YAML.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
    assert.equal(workflow.permissions.checks, "read");
    const verifyJob = workflow.jobs[verifyJobName];
    const providerJob = workflow.jobs[providerJobName];
    assert.equal(verifyJob.environment, undefined);
    assert.ok(
      Array.isArray(providerJob.needs)
        ? providerJob.needs.includes(verifyJobName)
        : providerJob.needs === verifyJobName,
    );
    const query = verifyJob.steps.find(
      (step) => step.name === "Read latest same-SHA required checks",
    );
    const validate = verifyJob.steps.find(
      (step) => step.name === "Require successful same-SHA protected checks",
    );
    const checkout = verifyJob.steps.find((step) =>
      String(step.uses || "").startsWith("actions/checkout@"),
    );
    const setupNode = verifyJob.steps.find((step) =>
      String(step.uses || "").startsWith("actions/setup-node@"),
    );
    assert.equal(checkout.with["persist-credentials"], false);
    assert.equal(query.env?.GH_TOKEN || verifyJob.env?.GH_TOKEN, "${{ github.token }}");
    assert.match(query.run, /check-runs\?filter=latest&per_page=100/u);
    assert.match(validate.run, /validate-github-required-checks\.cjs/u);
    assert.match(validate.run, /--candidate/u);
    assert.match(validate.run, /--input/u);
    assert.ok(verifyJob.steps.indexOf(setupNode) < verifyJob.steps.indexOf(query));
    assert.ok(verifyJob.steps.indexOf(query) < verifyJob.steps.indexOf(validate));
  }
});

test("all workflows pin external actions and disable checkout credential persistence", () => {
  const workflowDir = path.join(ROOT, ".github", "workflows");
  for (const file of fs.readdirSync(workflowDir).filter((name) => name.endsWith(".yml"))) {
    const workflow = YAML.parse(fs.readFileSync(path.join(workflowDir, file), "utf8"));
    assert.equal(workflow.permissions?.contents, "read", `${file} must default contents to read`);
    for (const job of Object.values(workflow.jobs || {})) {
      for (const step of job.steps || []) {
        const action = String(step.uses || "");
        if (!action || action.startsWith("./")) continue;
        assert.match(action, /@[0-9a-f]{40}$/u, `${file} must pin ${action} to a commit SHA`);
        if (action.startsWith("actions/checkout@")) {
          assert.equal(
            step.with?.["persist-credentials"],
            false,
            `${file} must disable checkout credential persistence`,
          );
        }
      }
    }
  }
});
