const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const YAML = require("yaml");

const ROOT = path.resolve(__dirname, "..", "..");
const PREVIEW_PATH = path.join(ROOT, ".github", "workflows", "eas-update-preview.yml");
const PRODUCTION_PATH = path.join(ROOT, ".github", "workflows", "eas-update-production.yml");

function readWorkflow(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return { raw, workflow: YAML.parse(raw) };
}

function stepIndex(steps, name) {
  const index = steps.findIndex((step) => step.name === name);
  assert.notEqual(index, -1, `missing workflow step: ${name}`);
  return index;
}

test("both OTA workflows parse and pin EAS installation outside all token-bearing steps", () => {
  for (const filePath of [PREVIEW_PATH, PRODUCTION_PATH]) {
    const { raw, workflow } = readWorkflow(filePath);
    assert.ok(workflow.jobs);
    assert.doesNotMatch(raw, /npx[^\n]*eas-cli/iu);
    for (const job of Object.values(workflow.jobs)) {
      assert.equal(job.env?.EXPO_TOKEN, undefined, "EXPO_TOKEN must never be job-scoped");
      const install = (job.steps || []).find(
        (step) => step.name === "Install pinned EAS CLI without provider credentials",
      );
      if (install) {
        assert.match(
          install.run,
          /npm install --global --ignore-scripts "eas-cli@\$\{EAS_CLI_VERSION\}"/u,
        );
        assert.equal(install.env?.EXPO_TOKEN, undefined);
      }
      for (const step of job.steps || []) {
        const hasToken = Object.prototype.hasOwnProperty.call(step.env || {}, "EXPO_TOKEN");
        if (hasToken) {
          assert.match(String(step.run || ""), /\beas (?:whoami|update|channel:)/u);
          assert.doesNotMatch(String(step.run || ""), /npm (?:ci|install)|node --test/u);
        }
        if (/^eas (?:whoami|update|channel:)/mu.test(String(step.run || "").trim())) {
          assert.equal(
            hasToken,
            true,
            `EAS provider invocation lacks step-scoped token: ${step.name}`,
          );
        }
      }
    }
  }
});

test("preview has an auditable protected device-attestation producer", () => {
  const { raw, workflow } = readWorkflow(PREVIEW_PATH);
  const inputs = workflow.on.workflow_dispatch.inputs;
  assert.deepEqual(inputs.mode.options, ["publish", "attest-devices"]);
  assert.ok(inputs.preview_run_id);
  assert.ok(inputs.binary_ota_evidence_path);
  assert.ok(inputs.device_manifest_base64);
  const job = workflow.jobs["attest-devices"];
  assert.equal(job.environment, "preview");
  assert.equal(job.needs, "verify-device-attestation");
  assert.match(job.if, /attest-devices/u);
  assert.match(raw, /validate-ota-device-evidence\.cjs/u);
  assert.match(raw, /eas-update-preview-device-evidence-\$\{\{ github\.sha \}\}/u);
  assert.match(raw, /device_manifest_base64/u);
  assert.doesNotMatch(raw, /device_manifest_base64:[\s\S]*default:/u);
});

test("production cannot publish before immutable Android and iOS device evidence", () => {
  const { raw, workflow } = readWorkflow(PRODUCTION_PATH);
  assert.equal(workflow.on.workflow_dispatch.inputs.device_evidence_run_id.required, true);
  const publishJob = workflow.jobs["publish-production"];
  assert.equal(publishJob.needs, "verify-production");
  const steps = publishJob.steps;
  const deviceRun = stepIndex(steps, "Download immutable same-SHA device evidence artifact");
  const deviceValidation = stepIndex(
    steps,
    "Revalidate Android and iOS preview runtime-device evidence",
  );
  const finalClassification = stepIndex(
    steps,
    "Revalidate full cleanliness and OTA classification immediately before publish",
  );
  const publish = stepIndex(steps, "Publish production update at five percent");
  const observation = stepIndex(steps, "Validate five-percent provider observation");
  const evidence = stepIndex(steps, "Write same-SHA production evidence");
  const revert = stepIndex(steps, "Revert production rollout after a post-publish failure");
  assert.ok(deviceRun < deviceValidation);
  assert.ok(deviceValidation < finalClassification);
  assert.equal(finalClassification + 1, publish);
  assert.ok(publish < observation && observation < evidence && evidence < revert);
  assert.match(raw, /run\.path !== "\.github\/workflows\/eas-update-preview\.yml"/u);
  assert.match(raw, /artifact\.digest/u);
  assert.match(raw, /--device-validation/u);
  assert.match(String(steps[publish].run), /--rollout-percentage 5/u);
  assert.match(String(steps[revert].run), /update:revert-update-rollout/u);
  assert.match(String(steps[revert].if), /failure\(\)/u);
});

test("both publish paths repeat clean-tree and classifier gates immediately before EAS update", () => {
  const cases = [
    [readWorkflow(PREVIEW_PATH).workflow, "publish-preview", "Publish isolated preview update"],
    [
      readWorkflow(PRODUCTION_PATH).workflow,
      "publish-production",
      "Publish production update at five percent",
    ],
  ];
  for (const [workflow, jobName, publishName] of cases) {
    const steps = workflow.jobs[jobName].steps;
    const publish = stepIndex(steps, publishName);
    const guard = steps[publish - 1];
    assert.equal(
      guard.name,
      "Revalidate full cleanliness and OTA classification immediately before publish",
    );
    assert.match(guard.run, /git status --porcelain=v1 --untracked-files=normal/u);
    assert.match(guard.run, /--require-ota-safe/u);
    assert.match(guard.run, /--require-ota-payload/u);
  }
});

test("provider mutation jobs depend on credential-free verification and use fresh checkouts", () => {
  const preview = readWorkflow(PREVIEW_PATH).workflow;
  const production = readWorkflow(PRODUCTION_PATH).workflow;
  for (const [workflow, verifyName, mutateName] of [
    [preview, "verify-preview", "publish-preview"],
    [preview, "verify-device-attestation", "attest-devices"],
    [production, "verify-production", "publish-production"],
  ]) {
    const verify = workflow.jobs[verifyName];
    const mutate = workflow.jobs[mutateName];
    assert.equal(verify.environment, undefined);
    assert.equal(mutate.needs, verifyName);
    assert.equal(verify.env?.EXPO_TOKEN, undefined);
    assert.match(mutate.steps[0].name, /fresh/u);
    assert.match(mutate.steps[0].uses, /^actions\/checkout@/u);
  }
  for (const jobName of ["publish-preview", "publish-production"]) {
    const workflow = jobName === "publish-preview" ? preview : production;
    const steps = workflow.jobs[jobName].steps;
    const npmCi = steps.findIndex((step) =>
      /Install locked dependencies in fresh/u.test(step.name),
    );
    const classify = steps.findIndex((step) => /Classify fresh immutable/u.test(step.name));
    const publish = steps.findIndex((step) => /^Publish /u.test(step.name));
    assert.ok(npmCi >= 0 && npmCi < classify && classify < publish);
  }
});
