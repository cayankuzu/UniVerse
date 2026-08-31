const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const yaml = require("js-yaml");
const {
  assertDeployment,
  assertHealthResponse,
  assertUploadWorkflowRun,
  assertVersionIdentity,
  buildUploadManifest,
  parseWranglerUploadOutput,
  sha256,
  validateActionInputs,
  validateUploadManifest,
} = require("./cloudflare-rollout-policy.cjs");

const PREVIOUS_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE_ID = "22222222-2222-4222-8222-222222222222";
const CANDIDATE_SHA = "a".repeat(40);
const TREE_SHA = "b".repeat(40);
const MANIFEST_SHA = "c".repeat(64);
const temporaryDirectories = [];
const PRODUCTION_WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../.github/workflows/cloudflare-production.yml",
);
const PREVIEW_WORKFLOW_PATH = path.resolve(
  __dirname,
  "../../.github/workflows/cloudflare-preview.yml",
);

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop(), { force: true, recursive: true });
  }
});

function deployment(versions) {
  return { id: "deployment-1", strategy: "percentage", versions };
}

function versionIdentity(overrides = {}) {
  return {
    annotations: {
      "workers/message": `production-candidate sha:${CANDIDATE_SHA}`,
      "workers/tag": `sha-${CANDIDATE_SHA}`,
    },
    id: CANDIDATE_ID,
    metadata: { created_on: "2026-08-30T12:00:00.000Z" },
    ...overrides,
  };
}

function validHeaders(overrides = {}) {
  return [
    "HTTP/2 200",
    "content-type: application/json; charset=UTF-8",
    "cache-control: private, no-store",
    `x-universe-worker-version-id: ${overrides.versionId || CANDIDATE_ID}`,
    `x-universe-worker-version-tag: ${overrides.tag || `sha-${CANDIDATE_SHA}`}`,
    "",
  ].join("\r\n");
}

function validHealthBody(overrides = {}) {
  return JSON.stringify({
    authRecoveryEndpointsEnabled: false,
    compatRoutesEnabled: false,
    legacyEdgeReadsEnabled: false,
    mediaScannerConfigured: true,
    status: "ok",
    ...overrides,
  });
}

test("enforces every rollout transition without permitting stage skipping", () => {
  const stages = [
    ["upload", "before", [[PREVIOUS_ID, 100]]],
    [
      "upload",
      "after",
      [
        [PREVIOUS_ID, 100],
        [CANDIDATE_ID, 0],
      ],
    ],
    [
      "rollout-5",
      "before",
      [
        [PREVIOUS_ID, 100],
        [CANDIDATE_ID, 0],
      ],
    ],
    [
      "rollout-5",
      "after",
      [
        [PREVIOUS_ID, 95],
        [CANDIDATE_ID, 5],
      ],
    ],
    [
      "rollout-25",
      "before",
      [
        [PREVIOUS_ID, 95],
        [CANDIDATE_ID, 5],
      ],
    ],
    [
      "rollout-25",
      "after",
      [
        [PREVIOUS_ID, 75],
        [CANDIDATE_ID, 25],
      ],
    ],
    [
      "rollout-50",
      "before",
      [
        [PREVIOUS_ID, 75],
        [CANDIDATE_ID, 25],
      ],
    ],
    [
      "rollout-50",
      "after",
      [
        [PREVIOUS_ID, 50],
        [CANDIDATE_ID, 50],
      ],
    ],
    [
      "rollout-100",
      "before",
      [
        [PREVIOUS_ID, 50],
        [CANDIDATE_ID, 50],
      ],
    ],
    [
      "rollout-100",
      "after",
      [
        [PREVIOUS_ID, 0],
        [CANDIDATE_ID, 100],
      ],
    ],
    ["rollback", "after", [[PREVIOUS_ID, 100]]],
  ];
  for (const [action, phase, traffic] of stages) {
    const result = assertDeployment({
      action,
      candidateVersionId:
        action === "rollback" || (action === "upload" && phase === "before")
          ? undefined
          : CANDIDATE_ID,
      deployment: deployment(
        traffic.map(([versionId, percentage]) => ({ percentage, version_id: versionId })),
      ),
      phase,
      previousVersionId: PREVIOUS_ID,
    });
    assert.equal(result.versions.length, traffic.length);
  }

  assert.throws(
    () =>
      assertDeployment({
        action: "rollout-25",
        candidateVersionId: CANDIDATE_ID,
        deployment: deployment([
          { percentage: 100, version_id: PREVIOUS_ID },
          { percentage: 0, version_id: CANDIDATE_ID },
        ]),
        phase: "after",
        previousVersionId: PREVIOUS_ID,
      }),
    /current deployment differs/u,
  );
});

test("parses the documented Wrangler NDJSON output instead of console text", () => {
  const upload = parseWranglerUploadOutput(
    [
      JSON.stringify({ type: "wrangler-session", version: 1 }),
      JSON.stringify({
        type: "version-upload",
        version: 1,
        version_id: CANDIDATE_ID,
        worker_name: "universe-edge-production",
        wrangler_environment: "production",
      }),
    ].join("\n"),
  );
  assert.equal(upload.versionId, CANDIDATE_ID);
  assert.throws(
    () => parseWranglerUploadOutput(`uploaded ${CANDIDATE_ID} for ${CANDIDATE_SHA}`),
    /not valid JSON/u,
  );
});

test("matches version ID, tag, and message as structured fields", () => {
  const result = assertVersionIdentity({
    expectedId: CANDIDATE_ID,
    expectedMessage: `production-candidate sha:${CANDIDATE_SHA}`,
    expectedTag: `sha-${CANDIDATE_SHA}`,
    version: versionIdentity(),
  });
  assert.equal(result.id, CANDIDATE_ID);
  assert.throws(
    () =>
      assertVersionIdentity({
        expectedId: CANDIDATE_ID,
        expectedMessage: `production-candidate sha:${CANDIDATE_SHA}`,
        expectedTag: `sha-${CANDIDATE_SHA}`,
        version: versionIdentity({
          annotations: {
            "workers/message": `unrelated text containing ${CANDIDATE_SHA}`,
            "workers/tag": "forged",
          },
        }),
      }),
    /tag does not match/u,
  );
});

test("requires a fixed HTTPS health URL and observe/enforce origin verification", () => {
  const common = {
    action: "rollout-5",
    candidateManifestSha256: MANIFEST_SHA,
    candidateSha: CANDIDATE_SHA,
    candidateTreeSha: TREE_SHA,
    candidateUploadRunId: "1234",
    candidateVersionId: CANDIDATE_ID,
    healthEvidenceRef: "release-evidence/1.0.133/health-window.json",
    healthcheckUrl: "https://api.example.com/health",
    originVerificationMode: "observe",
    previousVersionId: PREVIOUS_ID,
  };
  assert.equal(validateActionInputs(common).candidateVersionId, CANDIDATE_ID);
  assert.throws(
    () =>
      validateActionInputs({
        ...common,
        healthcheckUrl: "https://api.example.com/health?target=x",
      }),
    /exact HTTPS \/health/u,
  );
  assert.throws(
    () => validateActionInputs({ ...common, originVerificationMode: "off" }),
    /traffic is removed/u,
  );
  assert.doesNotThrow(() =>
    validateActionInputs({
      action: "rollback",
      healthcheckUrl: "https://api.example.com/health",
      originVerificationMode: "enforce",
      previousVersionId: PREVIOUS_ID,
    }),
  );
});

test("requires the candidate artifact to come from a successful same-SHA main workflow run", () => {
  const run = {
    conclusion: "success",
    event: "workflow_dispatch",
    head_branch: "main",
    head_sha: CANDIDATE_SHA,
    id: 1234,
    name: "cloudflare-production",
    path: ".github/workflows/cloudflare-production.yml",
    repository: { full_name: "example/UniVerse" },
    status: "completed",
  };
  assert.equal(
    assertUploadWorkflowRun({
      repository: "example/UniVerse",
      run,
      runId: "1234",
    }).headSha,
    CANDIDATE_SHA,
  );
  assert.throws(
    () =>
      assertUploadWorkflowRun({
        repository: "example/UniVerse",
        run: { ...run, conclusion: "failure" },
        runId: "1234",
      }),
    /provenance is invalid/u,
  );
});

test("proves both Version Override identity and the origin-backed health contract", () => {
  const evidence = assertHealthResponse({
    bodyRaw: validHealthBody(),
    expectedTag: `sha-${CANDIDATE_SHA}`,
    expectedVersionId: CANDIDATE_ID,
    headersRaw: validHeaders(),
  });
  assert.equal(evidence.originContract.status, "ok");
  assert.equal(
    assertHealthResponse({
      bodyRaw: validHealthBody(),
      headersRaw: [
        "HTTP/2 200",
        "content-type: application/json",
        "cache-control: no-store",
        "",
      ].join("\r\n"),
    }).originContract.status,
    "ok",
  );
  assert.throws(
    () =>
      assertHealthResponse({
        bodyRaw: JSON.stringify({ ok: true }),
        expectedTag: `sha-${CANDIDATE_SHA}`,
        expectedVersionId: CANDIDATE_ID,
        headersRaw: validHeaders(),
      }),
    /origin-backed/u,
  );
  assert.throws(
    () =>
      assertHealthResponse({
        bodyRaw: validHealthBody(),
        expectedTag: `sha-${CANDIDATE_SHA}`,
        expectedVersionId: PREVIOUS_ID,
        headersRaw: validHeaders(),
      }),
    /expected Worker version/u,
  );
});

test("binds and revalidates candidate SHA, tree, bundle hashes, version, tag, and run", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "universe-cloudflare-rollout-"));
  temporaryDirectories.push(directory);
  const bundleDirectory = path.join(directory, ".wrangler-production");
  fs.mkdirSync(bundleDirectory);
  const bundlePath = path.join(bundleDirectory, "index.js");
  fs.writeFileSync(bundlePath, "export default {};\n", "utf8");
  const bundleDigest = sha256(fs.readFileSync(bundlePath));
  const bundleHashesRaw = `${bundleDigest}  .wrangler-production/index.js\n`;
  const wranglerOutputRaw = `${JSON.stringify({
    type: "version-upload",
    version: 1,
    version_id: CANDIDATE_ID,
    worker_name: "universe-edge-production",
    wrangler_environment: "production",
  })}\n`;
  const manifest = buildUploadManifest({
    bundleHashesRaw,
    candidateSha: CANDIDATE_SHA,
    candidateTreeSha: TREE_SHA,
    generatedAt: "2026-08-30T12:00:00.000Z",
    repository: "example/UniVerse",
    runAttempt: "1",
    runId: "1234",
    version: versionIdentity(),
    workflowRef: "example/UniVerse/.github/workflows/cloudflare-production.yml@refs/heads/main",
    workerName: "universe-edge-production",
    wranglerOutputRaw,
  });
  const manifestPath = path.join(directory, "candidate-upload-manifest.json");
  const checksumPath = path.join(directory, "candidate-upload-manifest.json.sha256");
  const raw = `${JSON.stringify(manifest, null, 2)}\n`;
  const digest = sha256(raw);
  fs.writeFileSync(manifestPath, raw, "utf8");
  fs.writeFileSync(checksumPath, `${digest}  candidate-upload-manifest.json\n`, "utf8");

  assert.equal(
    validateUploadManifest({
      artifactRoot: directory,
      candidateSha: CANDIDATE_SHA,
      candidateTreeSha: TREE_SHA,
      candidateVersionId: CANDIDATE_ID,
      checksumPath,
      expectedDigest: digest,
      manifestPath,
      repository: "example/UniVerse",
      runId: "1234",
    }).worker.versionId,
    CANDIDATE_ID,
  );

  fs.writeFileSync(bundlePath, "tampered\n", "utf8");
  assert.throws(
    () =>
      validateUploadManifest({
        artifactRoot: directory,
        candidateSha: CANDIDATE_SHA,
        candidateTreeSha: TREE_SHA,
        candidateVersionId: CANDIDATE_ID,
        checksumPath,
        expectedDigest: digest,
        manifestPath,
        repository: "example/UniVerse",
        runId: "1234",
      }),
    /bundle hash differs/u,
  );
});

test("production workflow keeps Cloudflare credentials on Wrangler steps and rollback independent", () => {
  const workflow = yaml.load(fs.readFileSync(PRODUCTION_WORKFLOW_PATH, "utf8"));
  assert.equal(workflow.on.workflow_dispatch.inputs.healthcheck_url, undefined);
  assert.equal(workflow.permissions.actions, "read");
  assert.equal(workflow.jobs.production.environment, "production");
  assert.equal(workflow.jobs.production.env.HEALTHCHECK_URL.includes("vars."), true);
  assert.equal(workflow.jobs.production.env.ORIGIN_VERIFICATION_MODE.includes("vars."), true);
  assert.equal(workflow.jobs.rollback.needs, "dispatch_guard");
  assert.doesNotMatch(String(workflow.jobs.rollback.needs), /verify_candidate/u);
  assert.match(workflow.jobs.dispatch_guard.steps[0].run, /refs\/heads\/main/u);

  for (const job of Object.values(workflow.jobs)) {
    assert.equal(JSON.stringify(job.env || {}).includes("CLOUDFLARE_API_TOKEN"), false);
    for (const step of job.steps || []) {
      const hasCloudflareSecret = JSON.stringify(step.env || {}).includes(
        "CLOUDFLARE_PRODUCTION_API_TOKEN",
      );
      if (hasCloudflareSecret) assert.match(String(step.run || ""), /npx wrangler/u);
    }
  }

  const rollbackRun = (workflow.jobs.rollback.steps || [])
    .map((step) => String(step.run || ""))
    .join("\n");
  assert.doesNotMatch(rollbackRun, /security:verify:internal/u);
  assert.doesNotMatch(rollbackRun, /health-before|candidate-version-id/u);
  assert.match(rollbackRun, /wrangler rollback/u);
  assert.match(rollbackRun, /assert-deployment/u);
  assert.match(rollbackRun, /assert-health/u);
});

test("production workflow fixes stage order and deterministically probes version metadata", () => {
  const workflow = yaml.load(fs.readFileSync(PRODUCTION_WORKFLOW_PATH, "utf8"));
  const steps = workflow.jobs.production.steps;
  const apply = steps.find((step) => step.id === "apply");
  const healthAfter = steps.find((step) => step.id === "health_after");
  const restore = steps.find((step) => step.id === "restore");
  assert.match(apply.run, /@100.*@0/su);
  assert.match(apply.run, /@95.*@5/su);
  assert.match(apply.run, /@75.*@25/su);
  assert.match(apply.run, /@50.*@50/su);
  assert.match(apply.run, /@0.*@100/su);
  assert.match(healthAfter.run, /Cloudflare-Workers-Version-Overrides/u);
  assert.match(healthAfter.run, /--expected-version-id/u);
  assert.match(healthAfter.run, /--expected-tag/u);
  assert.match(restore.run, /wrangler rollback/u);
  assert.match(restore.if, /health_after\.outcome == 'failure'/u);
});

test("preview workflow also limits Cloudflare credentials to its Wrangler deploy step", () => {
  const workflow = yaml.load(fs.readFileSync(PREVIEW_WORKFLOW_PATH, "utf8"));
  const deployJob = workflow.jobs["deploy-preview"];
  assert.equal(JSON.stringify(deployJob.env).includes("CLOUDFLARE_API_TOKEN"), false);
  assert.equal(deployJob.env.ORIGIN_VERIFICATION_MODE.includes("vars."), true);
  const secretSteps = deployJob.steps.filter((step) =>
    JSON.stringify(step.env || {}).includes("CLOUDFLARE_PREVIEW_API_TOKEN"),
  );
  assert.equal(secretSteps.length, 1);
  assert.match(secretSteps[0].run, /npx wrangler deploy/u);
});
