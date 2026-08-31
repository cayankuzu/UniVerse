#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const PRODUCTION_WORKER = "universe-edge-production";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const TREE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUN_ID_PATTERN = /^[1-9][0-9]*$/u;
const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9._:/@#-]{1,256}$/u;
const ACTIONS = new Set([
  "upload",
  "rollout-5",
  "rollout-25",
  "rollout-50",
  "rollout-100",
  "rollback",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value;
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function readJson(filePath, label) {
  return assertObject(parseJson(fs.readFileSync(filePath, "utf8"), label), label);
}

function assertPattern(value, pattern, label) {
  const normalized = String(value || "").trim();
  if (!pattern.test(normalized)) throw new Error(`${label} is invalid.`);
  return normalized;
}

function assertUuid(value, label) {
  return assertPattern(value, UUID_PATTERN, label);
}

function assertCommitSha(value, label = "Candidate SHA") {
  return assertPattern(value, COMMIT_SHA_PATTERN, label);
}

function assertTreeSha(value, label = "Candidate tree SHA") {
  return assertPattern(value, TREE_SHA_PATTERN, label);
}

function assertSha256(value, label) {
  return assertPattern(value, SHA256_PATTERN, label);
}

function assertHealthUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new Error("The protected production health URL is invalid.");
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/health" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("The protected production health URL must be an exact HTTPS /health URL.");
  }
  return parsed.toString();
}

function assertOriginVerificationMode(value) {
  const mode = String(value || "").trim();
  if (mode !== "observe" && mode !== "enforce") {
    throw new Error(
      "CLOUDFLARE_ORIGIN_VERIFICATION_MODE must be observe or enforce while the selective gateway carries traffic; off is allowed only after that traffic is removed.",
    );
  }
  return mode;
}

function validateActionInputs(options) {
  const action = String(options.action || "").trim();
  if (!ACTIONS.has(action)) throw new Error("Cloudflare rollout action is invalid.");
  const previousVersionId = assertUuid(options.previousVersionId, "Previous version ID");
  const healthcheckUrl = assertHealthUrl(options.healthcheckUrl);
  const originVerificationMode = assertOriginVerificationMode(options.originVerificationMode);

  if (action === "rollback") {
    return { action, healthcheckUrl, originVerificationMode, previousVersionId };
  }

  const candidateSha = assertCommitSha(options.candidateSha);
  const candidateTreeSha = assertTreeSha(options.candidateTreeSha);
  const healthEvidenceRef = assertPattern(
    options.healthEvidenceRef,
    SAFE_REFERENCE_PATTERN,
    "Health evidence reference",
  );

  let candidateVersionId = null;
  if (action.startsWith("rollout-")) {
    candidateVersionId = assertUuid(options.candidateVersionId, "Candidate version ID");
    if (candidateVersionId === previousVersionId) {
      throw new Error("Candidate and previous version IDs must differ.");
    }
    assertPattern(options.candidateUploadRunId, RUN_ID_PATTERN, "Candidate upload run ID");
    assertSha256(options.candidateManifestSha256, "Candidate manifest SHA-256");
  }

  return {
    action,
    candidateSha,
    candidateTreeSha,
    candidateVersionId,
    healthEvidenceRef,
    healthcheckUrl,
    originVerificationMode,
    previousVersionId,
  };
}

function expectedTraffic(action, phase, previousVersionId, candidateVersionId) {
  const previous = assertUuid(previousVersionId, "Previous version ID");
  if (action === "rollback" && phase === "after") return new Map([[previous, 100]]);
  if (action === "upload" && phase === "before") return new Map([[previous, 100]]);
  const candidate = assertUuid(candidateVersionId, "Candidate version ID");
  if (candidate === previous) throw new Error("Candidate and previous version IDs must differ.");

  const transitions = {
    upload: { after: [100, 0] },
    "rollout-5": { before: [100, 0], after: [95, 5] },
    "rollout-25": { before: [95, 5], after: [75, 25] },
    "rollout-50": { before: [75, 25], after: [50, 50] },
    "rollout-100": { before: [50, 50], after: [0, 100] },
  };
  const pair = transitions[action]?.[phase];
  if (!pair) throw new Error(`Unsupported rollout transition: ${action}/${phase}.`);
  return new Map([
    [previous, pair[0]],
    [candidate, pair[1]],
  ]);
}

function normalizeDeployment(deployment) {
  const value = assertObject(deployment, "Wrangler deployment status");
  const deploymentId = String(value.id || "").trim();
  if (!deploymentId) {
    throw new Error("Wrangler deployment status is missing its deployment ID.");
  }
  if (!Array.isArray(value.versions) || value.versions.length === 0) {
    throw new Error("Wrangler deployment status has no versions.");
  }
  const traffic = new Map();
  for (const entry of value.versions) {
    const object = assertObject(entry, "Wrangler deployment version");
    const versionId = assertUuid(object.version_id, "Deployment version ID");
    const percentage = Number(object.percentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error(`Deployment percentage is invalid for ${versionId}.`);
    }
    if (traffic.has(versionId)) throw new Error(`Deployment repeats version ${versionId}.`);
    traffic.set(versionId, percentage);
  }
  const total = [...traffic.values()].reduce((sum, percentage) => sum + percentage, 0);
  if (Math.abs(total - 100) > 0.000001) throw new Error("Deployment traffic must total 100%.");
  return { deploymentId, traffic };
}

function assertDeployment(options) {
  const normalized = normalizeDeployment(options.deployment);
  const expected = expectedTraffic(
    options.action,
    options.phase,
    options.previousVersionId,
    options.candidateVersionId,
  );
  if (normalized.traffic.size !== expected.size) {
    throw new Error("Current Cloudflare deployment contains unexpected versions.");
  }
  for (const [versionId, percentage] of expected) {
    if (normalized.traffic.get(versionId) !== percentage) {
      throw new Error(`Expected ${versionId}@${percentage}, but the current deployment differs.`);
    }
  }
  return {
    deploymentId: normalized.deploymentId,
    versions: [...expected].map(([versionId, percentage]) => ({ percentage, versionId })),
  };
}

function assertVersionIdentity(options) {
  const version = assertObject(options.version, "Wrangler version response");
  const expectedId = assertUuid(options.expectedId, "Expected version ID");
  if (version.id !== expectedId) throw new Error("Wrangler returned a different version ID.");
  const annotations = assertObject(version.annotations || {}, "Wrangler version annotations");
  if (options.expectedTag !== undefined && annotations["workers/tag"] !== options.expectedTag) {
    throw new Error("Cloudflare version tag does not match the immutable candidate SHA.");
  }
  if (
    options.expectedMessage !== undefined &&
    annotations["workers/message"] !== options.expectedMessage
  ) {
    throw new Error("Cloudflare version message does not match the immutable candidate SHA.");
  }
  return {
    createdOn: String(version.metadata?.created_on || ""),
    id: expectedId,
    message: annotations["workers/message"] || null,
    tag: annotations["workers/tag"] || null,
  };
}

function assertUploadWorkflowRun(options) {
  const run = assertObject(options.run, "GitHub Actions run");
  const expectedRunId = Number(
    assertPattern(options.runId, RUN_ID_PATTERN, "Candidate upload run ID"),
  );
  const workflowHeadSha = assertCommitSha(run.head_sha, "Upload workflow head SHA");
  if (
    Number(run.id) !== expectedRunId ||
    run.name !== "cloudflare-production" ||
    run.path !== ".github/workflows/cloudflare-production.yml" ||
    run.event !== "workflow_dispatch" ||
    run.head_branch !== "main" ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.repository?.full_name !== options.repository
  ) {
    throw new Error("Candidate upload workflow run provenance is invalid or incomplete.");
  }
  return {
    conclusion: run.conclusion,
    event: run.event,
    headSha: workflowHeadSha,
    id: String(run.id),
    repository: run.repository.full_name,
    workflowPath: run.path,
  };
}

function parseWranglerUploadOutput(raw, workerName = PRODUCTION_WORKER) {
  const records = String(raw || "")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line, index) =>
      assertObject(parseJson(line, `Wrangler output line ${index + 1}`), "Wrangler output"),
    );
  const uploads = records.filter((record) => record.type === "version-upload");
  if (uploads.length !== 1)
    throw new Error("Wrangler output must contain exactly one version-upload record.");
  const upload = uploads[0];
  if (upload.version !== 1 || upload.worker_name !== workerName) {
    throw new Error("Wrangler version-upload identity is invalid.");
  }
  if (upload.wrangler_environment !== "production") {
    throw new Error("Wrangler version-upload did not target the production environment.");
  }
  return {
    versionId: assertUuid(upload.version_id, "Uploaded version ID"),
    workerName,
  };
}

function parseBundleHashes(raw) {
  const files = [];
  const paths = new Set();
  for (const line of String(raw || "").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/u.exec(line);
    if (!match) throw new Error("Bundle checksum manifest contains an invalid line.");
    const filePath = match[2].replaceAll("\\", "/").trim();
    if (!filePath || path.posix.isAbsolute(filePath) || filePath.split("/").includes("..")) {
      throw new Error("Bundle checksum manifest contains an unsafe path.");
    }
    if (paths.has(filePath)) throw new Error(`Bundle checksum manifest repeats ${filePath}.`);
    paths.add(filePath);
    files.push({ path: filePath, sha256: match[1] });
  }
  if (files.length === 0) throw new Error("Bundle checksum manifest is empty.");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function buildUploadManifest(options) {
  const candidateSha = assertCommitSha(options.candidateSha);
  const candidateTreeSha = assertTreeSha(options.candidateTreeSha);
  const workerName = String(options.workerName || PRODUCTION_WORKER);
  if (workerName !== PRODUCTION_WORKER) throw new Error("Production Worker name is invalid.");
  const upload = parseWranglerUploadOutput(options.wranglerOutputRaw, workerName);
  const expectedTag = `sha-${candidateSha}`;
  const expectedMessage = `production-candidate sha:${candidateSha}`;
  const identity = assertVersionIdentity({
    expectedId: upload.versionId,
    expectedMessage,
    expectedTag,
    version: options.version,
  });
  const bundleFiles = parseBundleHashes(options.bundleHashesRaw);
  const repository = String(options.repository || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    throw new Error("GitHub repository identity is invalid.");
  }
  const runId = assertPattern(options.runId, RUN_ID_PATTERN, "Workflow run ID");
  const runAttempt = assertPattern(options.runAttempt, RUN_ID_PATTERN, "Workflow run attempt");
  const workflowRef = String(options.workflowRef || "").trim();
  if (!workflowRef || workflowRef.length > 512) throw new Error("Workflow ref is invalid.");

  return {
    schemaVersion: 1,
    kind: "cloudflare-worker-candidate-upload",
    source: { candidateSha, candidateTreeSha, repository },
    worker: {
      environment: "production",
      name: workerName,
      versionCreatedOn: identity.createdOn,
      versionId: identity.id,
      versionMessage: identity.message,
      versionTag: identity.tag,
    },
    bundle: {
      checksumManifestSha256: sha256(options.bundleHashesRaw),
      files: bundleFiles,
    },
    run: { attempt: runAttempt, id: runId, workflowRef },
    generatedAt: String(options.generatedAt || new Date().toISOString()),
  };
}

function writeUploadManifest(options) {
  const manifest = buildUploadManifest(options);
  const raw = `${JSON.stringify(manifest, null, 2)}\n`;
  const digest = sha256(raw);
  fs.writeFileSync(options.outputPath, raw, "utf8");
  fs.writeFileSync(
    options.checksumPath,
    `${digest}  ${path.basename(options.outputPath)}\n`,
    "utf8",
  );
  if (options.githubOutputPath) {
    fs.appendFileSync(
      options.githubOutputPath,
      `candidate_version_id=${manifest.worker.versionId}\ncandidate_manifest_sha256=${digest}\n`,
      "utf8",
    );
  }
  return { digest, manifest };
}

function validateUploadManifest(options) {
  const raw = fs.readFileSync(options.manifestPath, "utf8");
  const actualDigest = sha256(raw);
  const expectedDigest = assertSha256(options.expectedDigest, "Candidate manifest SHA-256");
  if (actualDigest !== expectedDigest)
    throw new Error("Candidate upload manifest checksum differs.");
  const checksumRaw = fs.readFileSync(options.checksumPath, "utf8").trim();
  const checksumMatch = /^([0-9a-f]{64})\s+(.+)$/u.exec(checksumRaw);
  if (!checksumMatch || checksumMatch[1] !== actualDigest) {
    throw new Error("Candidate upload manifest checksum file is invalid.");
  }
  const manifest = assertObject(
    parseJson(raw, "Candidate upload manifest"),
    "Candidate upload manifest",
  );
  if (manifest.schemaVersion !== 1 || manifest.kind !== "cloudflare-worker-candidate-upload") {
    throw new Error("Candidate upload manifest schema is invalid.");
  }
  const candidateSha = assertCommitSha(options.candidateSha);
  const candidateTreeSha = assertTreeSha(options.candidateTreeSha);
  const expectedVersionId = assertUuid(options.candidateVersionId, "Candidate version ID");
  if (
    manifest.source?.candidateSha !== candidateSha ||
    manifest.source?.candidateTreeSha !== candidateTreeSha ||
    manifest.source?.repository !== options.repository ||
    manifest.worker?.name !== PRODUCTION_WORKER ||
    manifest.worker?.environment !== "production" ||
    manifest.worker?.versionId !== expectedVersionId ||
    manifest.worker?.versionTag !== `sha-${candidateSha}` ||
    manifest.worker?.versionMessage !== `production-candidate sha:${candidateSha}` ||
    String(manifest.run?.id) !== String(options.runId)
  ) {
    throw new Error("Candidate upload manifest identity does not match this promotion.");
  }
  if (!Array.isArray(manifest.bundle?.files) || manifest.bundle.files.length === 0) {
    throw new Error("Candidate upload manifest has no bundle hashes.");
  }
  const artifactRoot = path.resolve(options.artifactRoot);
  const realArtifactRoot = fs.realpathSync(artifactRoot);
  for (const entry of manifest.bundle.files) {
    const relativePath = String(entry?.path || "").replaceAll("\\", "/");
    const expectedFileHash = assertSha256(entry?.sha256, `Bundle hash for ${relativePath}`);
    const absolutePath = path.resolve(artifactRoot, relativePath);
    const relativeResolved = path.relative(artifactRoot, absolutePath);
    if (relativeResolved.startsWith("..") || path.isAbsolute(relativeResolved)) {
      throw new Error("Candidate upload manifest bundle path escapes its artifact root.");
    }
    if (!fs.existsSync(absolutePath))
      throw new Error(`Candidate bundle file is missing: ${relativePath}.`);
    const fileStat = fs.lstatSync(absolutePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new Error(`Candidate bundle path is not a regular file: ${relativePath}.`);
    }
    const realFilePath = fs.realpathSync(absolutePath);
    const realRelative = path.relative(realArtifactRoot, realFilePath);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new Error("Candidate bundle file resolves outside its artifact root.");
    }
    const actualFileHash = sha256(fs.readFileSync(absolutePath));
    if (actualFileHash !== expectedFileHash)
      throw new Error(`Candidate bundle hash differs: ${relativePath}.`);
  }
  return manifest;
}

function parseHeaders(raw) {
  const headers = new Map();
  for (const line of String(raw || "").split(/\r?\n/u)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return headers;
}

function assertHealthResponse(options) {
  const expectedVersionId = options.expectedVersionId
    ? assertUuid(options.expectedVersionId, "Expected health version ID")
    : null;
  const headers = parseHeaders(options.headersRaw);
  if (expectedVersionId && headers.get("x-universe-worker-version-id") !== expectedVersionId) {
    throw new Error("Health response did not execute the expected Worker version.");
  }
  if (
    options.expectedTag !== undefined &&
    headers.get("x-universe-worker-version-tag") !== options.expectedTag
  ) {
    throw new Error("Health response Worker tag does not match the immutable candidate SHA.");
  }
  if (
    !String(headers.get("content-type") || "")
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new Error("Health response must be JSON.");
  }
  if (
    !String(headers.get("cache-control") || "")
      .toLowerCase()
      .split(",")
      .map((v) => v.trim())
      .includes("no-store")
  ) {
    throw new Error("Health response must be no-store.");
  }
  const body = assertObject(parseJson(options.bodyRaw, "Health response"), "Health response");
  if (
    body.status !== "ok" ||
    body.legacyEdgeReadsEnabled !== false ||
    body.authRecoveryEndpointsEnabled !== false ||
    body.compatRoutesEnabled !== false ||
    typeof body.mediaScannerConfigured !== "boolean"
  ) {
    throw new Error("Health response is not the origin-backed Supabase contract.");
  }
  return {
    cacheControl: headers.get("cache-control"),
    originContract: {
      authRecoveryEndpointsEnabled: body.authRecoveryEndpointsEnabled,
      compatRoutesEnabled: body.compatRoutesEnabled,
      legacyEdgeReadsEnabled: body.legacyEdgeReadsEnabled,
      mediaScannerConfigured: body.mediaScannerConfigured,
      status: body.status,
    },
    versionId: headers.get("x-universe-worker-version-id") || null,
    versionTag: headers.get("x-universe-worker-version-tag") || null,
  };
}

function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error(`Invalid CLI option: ${key || "<empty>"}.`);
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function requiredOption(options, key) {
  const value = options[key];
  if (value === undefined || value === "") throw new Error(`Missing --${key}.`);
  return value;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runCli(argv) {
  const { command, options } = parseCliArgs(argv);
  if (command === "validate-inputs") {
    const result = validateActionInputs({
      action: requiredOption(options, "action"),
      candidateManifestSha256: options["candidate-manifest-sha256"],
      candidateSha: options["candidate-sha"],
      candidateTreeSha: options["candidate-tree-sha"],
      candidateUploadRunId: options["candidate-upload-run-id"],
      candidateVersionId: options["candidate-version-id"],
      healthEvidenceRef: options["health-evidence-ref"],
      healthcheckUrl: requiredOption(options, "healthcheck-url"),
      originVerificationMode: requiredOption(options, "origin-verification-mode"),
      previousVersionId: requiredOption(options, "previous-version-id"),
    });
    console.log(JSON.stringify(result));
    return;
  }
  if (command === "assert-origin-mode") {
    console.log(assertOriginVerificationMode(requiredOption(options, "value")));
    return;
  }
  if (command === "assert-version") {
    const identity = assertVersionIdentity({
      expectedId: requiredOption(options, "expected-id"),
      expectedMessage: options["expected-message"],
      expectedTag: options["expected-tag"],
      version: readJson(requiredOption(options, "version-json"), "Wrangler version response"),
    });
    if (options.output) writeJson(options.output, identity);
    console.log(JSON.stringify(identity));
    return;
  }
  if (command === "assert-upload-run") {
    const evidence = assertUploadWorkflowRun({
      repository: requiredOption(options, "repository"),
      run: readJson(requiredOption(options, "run-json"), "GitHub Actions run"),
      runId: requiredOption(options, "run-id"),
    });
    if (options.output) writeJson(options.output, evidence);
    console.log(JSON.stringify(evidence));
    return;
  }
  if (command === "parse-upload") {
    const upload = parseWranglerUploadOutput(
      fs.readFileSync(requiredOption(options, "wrangler-output"), "utf8"),
      requiredOption(options, "worker-name"),
    );
    if (options["github-output"]) {
      fs.appendFileSync(
        options["github-output"],
        `candidate_version_id=${upload.versionId}\n`,
        "utf8",
      );
    }
    console.log(JSON.stringify(upload));
    return;
  }
  if (command === "assert-deployment") {
    const evidence = assertDeployment({
      action: requiredOption(options, "action"),
      candidateVersionId: options["candidate-version-id"],
      deployment: readJson(requiredOption(options, "status-json"), "Wrangler deployment status"),
      phase: requiredOption(options, "phase"),
      previousVersionId: requiredOption(options, "previous-version-id"),
    });
    if (options.output) writeJson(options.output, evidence);
    console.log(JSON.stringify(evidence));
    return;
  }
  if (command === "write-upload-manifest") {
    const result = writeUploadManifest({
      bundleHashesRaw: fs.readFileSync(requiredOption(options, "bundle-hashes"), "utf8"),
      candidateSha: requiredOption(options, "candidate-sha"),
      candidateTreeSha: requiredOption(options, "candidate-tree-sha"),
      checksumPath: requiredOption(options, "checksum-output"),
      githubOutputPath: options["github-output"],
      outputPath: requiredOption(options, "output"),
      repository: requiredOption(options, "repository"),
      runAttempt: requiredOption(options, "run-attempt"),
      runId: requiredOption(options, "run-id"),
      version: readJson(requiredOption(options, "version-json"), "Wrangler version response"),
      workflowRef: requiredOption(options, "workflow-ref"),
      workerName: requiredOption(options, "worker-name"),
      wranglerOutputRaw: fs.readFileSync(requiredOption(options, "wrangler-output"), "utf8"),
    });
    console.log(
      JSON.stringify({ digest: result.digest, versionId: result.manifest.worker.versionId }),
    );
    return;
  }
  if (command === "validate-upload-manifest") {
    const manifest = validateUploadManifest({
      artifactRoot: requiredOption(options, "artifact-root"),
      candidateSha: requiredOption(options, "candidate-sha"),
      candidateTreeSha: requiredOption(options, "candidate-tree-sha"),
      candidateVersionId: requiredOption(options, "candidate-version-id"),
      checksumPath: requiredOption(options, "checksum"),
      expectedDigest: requiredOption(options, "expected-digest"),
      manifestPath: requiredOption(options, "manifest"),
      repository: requiredOption(options, "repository"),
      runId: requiredOption(options, "run-id"),
    });
    console.log(JSON.stringify({ versionId: manifest.worker.versionId }));
    return;
  }
  if (command === "assert-health") {
    const evidence = assertHealthResponse({
      bodyRaw: fs.readFileSync(requiredOption(options, "body"), "utf8"),
      expectedTag: options["expected-tag"],
      expectedVersionId: options["expected-version-id"],
      headersRaw: fs.readFileSync(requiredOption(options, "headers"), "utf8"),
    });
    if (options.output) writeJson(options.output, evidence);
    console.log(JSON.stringify(evidence));
    return;
  }
  throw new Error(`Unsupported command: ${command || "<empty>"}.`);
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`[cloudflare-rollout-policy] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

module.exports = {
  PRODUCTION_WORKER,
  assertDeployment,
  assertHealthResponse,
  assertHealthUrl,
  assertOriginVerificationMode,
  assertUploadWorkflowRun,
  assertVersionIdentity,
  buildUploadManifest,
  expectedTraffic,
  parseBundleHashes,
  parseWranglerUploadOutput,
  sha256,
  validateActionInputs,
  validateUploadManifest,
  writeUploadManifest,
};
