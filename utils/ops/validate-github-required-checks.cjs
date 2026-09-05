#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const GITHUB_ACTIONS_APP_ID = 15368;
const MAX_CHECK_RUNS_PER_PAGE = 100;
const REQUIRED_CHECK_NAMES = Object.freeze([
  "internal-verify",
  "secret-scan",
  "sast",
  "docker-validate-immutable",
]);

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `check-runs response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertCandidateSha(candidateSha) {
  if (!FULL_SHA_PATTERN.test(candidateSha)) {
    throw new Error("candidate must be an exact lowercase 40-character commit SHA.");
  }
}

function assertCompleteSinglePage(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("check-runs response must be one JSON object, not a paginated page array.");
  }
  if (!Number.isSafeInteger(response.total_count) || response.total_count < 0) {
    throw new Error("check-runs total_count must be a non-negative safe integer.");
  }
  if (!Array.isArray(response.check_runs)) {
    throw new Error("check-runs response must contain a check_runs array.");
  }
  if (response.total_count > MAX_CHECK_RUNS_PER_PAGE) {
    throw new Error("check-runs response requires pagination; refusing an incomplete decision.");
  }
  if (response.check_runs.length !== response.total_count) {
    throw new Error("check-runs response is truncated or has an inconsistent total_count.");
  }
  if (
    response.incomplete_results === true ||
    response.truncated === true ||
    response.has_next_page === true ||
    response.next !== undefined
  ) {
    throw new Error("check-runs response reports pagination or truncation.");
  }
}

function validateRequiredChecks(rawOrValue, candidateSha) {
  assertCandidateSha(candidateSha);
  const response = typeof rawOrValue === "string" ? parseJson(rawOrValue) : rawOrValue;
  assertCompleteSinglePage(response);

  const validated = {};
  for (const expectedName of REQUIRED_CHECK_NAMES) {
    const matches = response.check_runs.filter((run) => run?.name === expectedName);
    if (matches.length === 0) {
      throw new Error(`required check is missing: ${expectedName}.`);
    }

    // One name can legitimately appear more than once on a SHA: a branch that is
    // both pushed to and open as a pull request fires a workflow twice. That is
    // only ambiguous when the runs disagree, so every instance is checked and a
    // name is satisfied only if all of them pass. A single failure among many
    // successes still fails the gate.
    for (const run of matches) {
      if (!run || typeof run !== "object" || Array.isArray(run)) {
        throw new Error(`required check is not a record: ${expectedName}.`);
      }
      if (run.head_sha !== candidateSha) {
        throw new Error(`required check head_sha mismatch: ${expectedName}.`);
      }
      if (run.app?.id !== GITHUB_ACTIONS_APP_ID) {
        throw new Error(
          `required check was not produced by the GitHub Actions app: ${expectedName}.`,
        );
      }
      if (run.status !== "completed" || run.conclusion !== "success") {
        throw new Error(`required check is not completed successfully: ${expectedName}.`);
      }
    }

    const run = matches[0];
    validated[expectedName] = {
      appId: run.app.id,
      conclusion: run.conclusion,
      headSha: run.head_sha,
      runCount: matches.length,
      status: run.status,
    };
  }

  return {
    candidateSha,
    checks: validated,
    expectedCheckCount: REQUIRED_CHECK_NAMES.length,
    observedCheckRunCount: response.check_runs.length,
  };
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== "--candidate" && argument !== "--input") {
      throw new Error(`unexpected argument: ${argument}`);
    }
    if (Object.prototype.hasOwnProperty.call(options, argument)) {
      throw new Error(`duplicate argument: ${argument}`);
    }
    index += 1;
    if (index >= args.length || args[index].startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument] = args[index];
  }
  return options;
}

function required(options, name) {
  const value = String(options[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const candidateSha = required(options, "--candidate");
  const inputPath = path.resolve(required(options, "--input"));
  const summary = validateRequiredChecks(fs.readFileSync(inputPath, "utf8"), candidateSha);
  console.log(
    `[github-required-checks] OK: ${summary.expectedCheckCount} checks passed for ${candidateSha}.`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      `[github-required-checks] FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  GITHUB_ACTIONS_APP_ID,
  REQUIRED_CHECK_NAMES,
  parseArguments,
  validateRequiredChecks,
};
