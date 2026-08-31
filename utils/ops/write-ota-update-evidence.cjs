#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const {
  CLASSIFICATION,
  assertFullSha,
  normalizeRepoPath,
} = require("../guards/classify-ota-diff.cjs");
const {
  parseNonEmptyJson,
  validateGeneratedMetadata,
  validatePublishedUpdates,
} = require("./validate-ota-provider.cjs");

const EVIDENCE_KIND = Object.freeze({
  PREVIEW: "preview",
  PRODUCTION: "production",
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson(raw, label) {
  return parseNonEmptyJson(raw, label);
}

function validateClassifierReport(report, baseSha, headSha, headTreeSha) {
  if (!report || report.schemaVersion !== 1) {
    throw new Error("Classifier evidence must use schemaVersion 1.");
  }
  if (report.baseSha !== baseSha || report.headSha !== headSha) {
    throw new Error("Classifier evidence SHA range does not match the requested release range.");
  }
  if (report.headTreeSha !== headTreeSha) {
    throw new Error("Classifier evidence tree SHA does not match the candidate tree.");
  }
  if (report.classification !== CLASSIFICATION.OTA_SAFE || report.hasOtaPayload !== true) {
    throw new Error("Classifier evidence must be OTA_SAFE and contain an OTA runtime payload.");
  }
  if (!Array.isArray(report.files) || report.files.length === 0) {
    throw new Error("Classifier evidence must contain changed files.");
  }
  if (!/^[0-9a-f]{64}$/u.test(String(report.policySha256 || ""))) {
    throw new Error("Classifier evidence must contain the committed policy SHA-256.");
  }
}

function validateReleaseConfig(appRelease) {
  if (!appRelease || typeof appRelease !== "object") {
    throw new Error("config/app-release.json is required.");
  }
  const requiredValues = [
    appRelease.version,
    appRelease.runtimeVersion,
    appRelease?.android?.package,
    appRelease?.android?.versionCode,
    appRelease?.ios?.bundleIdentifier,
    appRelease?.ios?.buildNumber,
  ];
  if (requiredValues.some((value) => String(value ?? "").trim() === "")) {
    throw new Error("config/app-release.json is missing release identity fields.");
  }
}

function validateKindAndTarget(kind, channel, environment, rolloutPercentage) {
  if (!Object.values(EVIDENCE_KIND).includes(kind)) {
    throw new Error(`Unsupported OTA evidence kind: ${kind}`);
  }
  if (channel !== kind || environment !== kind) {
    throw new Error(`${kind} evidence must use the isolated ${kind} channel and environment.`);
  }
  const expectedRollout = kind === EVIDENCE_KIND.PRODUCTION ? 5 : 100;
  if (rolloutPercentage !== expectedRollout) {
    throw new Error(`${kind} evidence must record the initial ${expectedRollout}% rollout.`);
  }
}

function validateArtifactEntry(entry, evidenceDirectory, label) {
  if (!entry || typeof entry !== "object") throw new Error(`${label} artifact entry is missing.`);
  const relativePath = normalizeRepoPath(String(entry.path || ""));
  if (!/^[0-9a-f]{64}$/u.test(String(entry.sha256 || ""))) {
    throw new Error(`${label} artifact checksum is invalid.`);
  }
  const absolutePath = path.resolve(evidenceDirectory, relativePath);
  const relativeToEvidence = path.relative(evidenceDirectory, absolutePath);
  if (relativeToEvidence.startsWith("..") || path.isAbsolute(relativeToEvidence)) {
    throw new Error(`${label} artifact path escapes its evidence directory.`);
  }
  if (!fs.existsSync(absolutePath))
    throw new Error(`${label} artifact is missing: ${relativePath}`);
  const actualChecksum = sha256(fs.readFileSync(absolutePath));
  if (actualChecksum !== entry.sha256) throw new Error(`${label} artifact checksum mismatch.`);
  return absolutePath;
}

function validatePreviewEvidence({ manifestPath, checksumPath, candidateSha }) {
  if (!manifestPath || !checksumPath) {
    throw new Error("Production evidence requires preview manifest and checksum files.");
  }
  const manifestRaw = fs.readFileSync(manifestPath);
  const expectedChecksum = fs.readFileSync(checksumPath, "utf8").trim().split(/\s+/u)[0];
  if (!/^[0-9a-f]{64}$/u.test(expectedChecksum)) {
    throw new Error("Preview manifest checksum file is invalid.");
  }
  const actualChecksum = sha256(manifestRaw);
  if (actualChecksum !== expectedChecksum) {
    throw new Error("Preview manifest checksum does not match the downloaded preview evidence.");
  }

  const manifest = parseJson(manifestRaw.toString("utf8"), "Preview evidence manifest");
  if (manifest.schemaVersion !== 1 || manifest.kind !== EVIDENCE_KIND.PREVIEW) {
    throw new Error("Preview evidence manifest kind or schema is invalid.");
  }
  if (manifest?.source?.candidateSha !== candidateSha) {
    throw new Error("Preview evidence is not tied to the production candidate SHA.");
  }
  if (
    manifest?.target?.channel !== EVIDENCE_KIND.PREVIEW ||
    manifest?.target?.environment !== EVIDENCE_KIND.PREVIEW
  ) {
    throw new Error("Preview evidence does not use the isolated preview target.");
  }
  if (
    manifest?.classifier?.classification !== CLASSIFICATION.OTA_SAFE ||
    manifest?.classifier?.hasOtaPayload !== true ||
    manifest?.claims?.providerCommandCompleted !== true
  ) {
    throw new Error("Preview evidence does not prove a completed OTA-safe preview command.");
  }

  const evidenceDirectory = path.dirname(path.resolve(manifestPath));
  validateArtifactEntry(
    manifest?.artifacts?.classifierReport,
    evidenceDirectory,
    "Preview classifier",
  );
  const providerOutputPath = validateArtifactEntry(
    manifest?.artifacts?.providerOutput,
    evidenceDirectory,
    "Preview provider output",
  );
  const updateMetadataPath = validateArtifactEntry(
    manifest?.artifacts?.updateMetadata,
    evidenceDirectory,
    "Preview update metadata",
  );
  const provider = validatePublishedUpdates(fs.readFileSync(providerOutputPath, "utf8"), {
    branch: EVIDENCE_KIND.PREVIEW,
    candidateSha,
    expectedMessage: manifest?.provider?.message,
    kind: EVIDENCE_KIND.PREVIEW,
    runtimeVersion: manifest?.release?.runtimeVersion,
  });
  validateGeneratedMetadata(
    fs.readFileSync(updateMetadataPath, "utf8"),
    {
      branch: EVIDENCE_KIND.PREVIEW,
      candidateSha,
      expectedMessage: manifest?.provider?.message,
      kind: EVIDENCE_KIND.PREVIEW,
      runtimeVersion: manifest?.release?.runtimeVersion,
    },
    provider,
  );
  const providerObservationPath = validateArtifactEntry(
    manifest?.artifacts?.providerObservation,
    evidenceDirectory,
    "Preview provider observation",
  );
  validateProviderObservationSummary(
    parseJson(fs.readFileSync(providerObservationPath, "utf8"), "Preview provider observation"),
    provider,
    {
      candidateSha,
      kind: EVIDENCE_KIND.PREVIEW,
      rolloutPercentage: 100,
      runtimeVersion: manifest?.release?.runtimeVersion,
    },
  );
  if (JSON.stringify(manifest.provider) !== JSON.stringify(provider)) {
    throw new Error("Preview provider identity does not match its retained provider artifacts.");
  }
  return { manifest, provider, sha256: actualChecksum };
}

function validateProviderObservationSummary(summary, provider, expected) {
  if (summary?.schemaVersion !== 1 || summary?.kind !== "eas-update-provider-observation") {
    throw new Error("Provider observation schema or kind is invalid.");
  }
  if (
    summary?.provider?.groupId !== provider.groupId ||
    summary?.provider?.candidateSha !== expected.candidateSha ||
    summary?.provider?.runtimeVersion !== expected.runtimeVersion ||
    summary?.observed?.channel !== expected.kind ||
    summary?.observed?.branch !== expected.kind ||
    summary?.observed?.rolloutPercentage !== expected.rolloutPercentage
  ) {
    throw new Error("Provider observation does not match the published OTA target.");
  }
  for (const platform of ["android", "ios"]) {
    if (summary?.provider?.platforms?.[platform]?.id !== provider.platforms[platform].id) {
      throw new Error(`Provider observation ${platform} update ID mismatch.`);
    }
  }
  return summary;
}

function validateDeviceValidationSummary(summary, expected) {
  if (
    summary?.schemaVersion !== 1 ||
    summary?.kind !== "validated-preview-runtime-device-evidence"
  ) {
    throw new Error("Production evidence requires validated preview runtime-device evidence.");
  }
  if (
    summary.candidateSha !== expected.candidateSha ||
    summary.runtimeVersion !== expected.runtimeVersion ||
    summary.previewUpdateGroupId !== expected.previewGroupId
  ) {
    throw new Error("Runtime-device validation does not match the production candidate.");
  }
  for (const claim of [
    "androidDeviceVerified",
    "iosDeviceVerified",
    "updateAppliedVerified",
    "coldLaunchVerified",
    "warmLaunchVerified",
    "offlineLaunchVerified",
    "criticalFlowsVerified",
  ]) {
    if (summary?.claims?.[claim] !== true) {
      throw new Error(`Runtime-device validation claim ${claim} is missing.`);
    }
  }
  return summary;
}

function buildEvidence({
  appRelease,
  baseSha,
  candidateSha,
  channel,
  classifierPath,
  classifierRaw,
  easCliVersion,
  environment,
  generatedAt,
  gitTreeSha,
  kind,
  providerOutputPath,
  providerOutputRaw,
  providerObservationPath,
  providerObservationRaw,
  providerStderrPath,
  providerStderrRaw,
  updateMetadataPath,
  updateMetadataRaw,
  repository,
  rolloutPercentage,
  workflowRunAttempt,
  workflowRunId,
  previewEvidence,
  deviceValidationPath,
  deviceValidationRaw,
}) {
  const immutableBaseSha = assertFullSha(baseSha, "base SHA");
  const immutableCandidateSha = assertFullSha(candidateSha, "candidate SHA");
  const immutableTreeSha = assertFullSha(gitTreeSha, "git tree SHA");
  validateKindAndTarget(kind, channel, environment, rolloutPercentage);
  validateReleaseConfig(appRelease);
  const classifierReport = parseJson(classifierRaw, "OTA classifier report");
  validateClassifierReport(
    classifierReport,
    immutableBaseSha,
    immutableCandidateSha,
    immutableTreeSha,
  );
  const provider = validatePublishedUpdates(providerOutputRaw, {
    branch: kind,
    candidateSha: immutableCandidateSha,
    kind,
    runtimeVersion: String(appRelease.runtimeVersion),
  });
  validateGeneratedMetadata(
    updateMetadataRaw,
    {
      branch: kind,
      candidateSha: immutableCandidateSha,
      expectedMessage: provider.message,
      kind,
      runtimeVersion: String(appRelease.runtimeVersion),
    },
    provider,
  );
  const providerObservation = validateProviderObservationSummary(
    parseJson(providerObservationRaw, "EAS provider observation"),
    provider,
    {
      candidateSha: immutableCandidateSha,
      kind,
      rolloutPercentage,
      runtimeVersion: String(appRelease.runtimeVersion),
    },
  );

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?$/iu.test(easCliVersion)) {
    throw new Error("The pinned EAS CLI version is invalid.");
  }
  if (!repository || !/^[-_.a-z0-9]+\/[-_.a-z0-9]+$/iu.test(repository)) {
    throw new Error("GitHub repository identity must be owner/name.");
  }

  let validatedPreview = null;
  let validatedDevice = null;
  if (kind === EVIDENCE_KIND.PRODUCTION) {
    if (!previewEvidence)
      throw new Error("Production evidence requires same-SHA preview evidence.");
    if (previewEvidence.manifest?.source?.candidateSha !== immutableCandidateSha) {
      throw new Error(
        "Production evidence received preview evidence for a different candidate SHA.",
      );
    }
    validatedPreview = previewEvidence;
    validatedDevice = validateDeviceValidationSummary(
      parseJson(deviceValidationRaw, "Runtime-device validation"),
      {
        candidateSha: immutableCandidateSha,
        previewGroupId: validatedPreview.provider.groupId,
        runtimeVersion: String(appRelease.runtimeVersion),
      },
    );
  }

  const artifacts = {
    classifierReport: {
      path: normalizeRepoPath(classifierPath),
      sha256: sha256(classifierRaw),
    },
    providerOutput: {
      path: normalizeRepoPath(providerOutputPath),
      sha256: sha256(providerOutputRaw),
    },
    providerObservation: {
      path: normalizeRepoPath(providerObservationPath),
      sha256: sha256(providerObservationRaw),
    },
    updateMetadata: {
      path: normalizeRepoPath(updateMetadataPath),
      sha256: sha256(updateMetadataRaw),
    },
  };
  if (validatedDevice !== null) {
    artifacts.deviceValidation = {
      path: normalizeRepoPath(deviceValidationPath),
      sha256: sha256(deviceValidationRaw),
    };
  }
  if (providerStderrPath && providerStderrRaw !== undefined) {
    artifacts.providerStderr = {
      path: normalizeRepoPath(providerStderrPath),
      sha256: sha256(providerStderrRaw),
    };
  }

  return {
    schemaVersion: 1,
    kind,
    generatedAt,
    source: {
      repository,
      baseSha: immutableBaseSha,
      candidateSha: immutableCandidateSha,
      candidateTreeSha: immutableTreeSha,
      workflowRunId: String(workflowRunId || ""),
      workflowRunAttempt: String(workflowRunAttempt || ""),
    },
    release: {
      version: String(appRelease.version),
      runtimeVersion: String(appRelease.runtimeVersion),
      android: {
        package: String(appRelease.android.package),
        versionCode: Number(appRelease.android.versionCode),
      },
      ios: {
        bundleIdentifier: String(appRelease.ios.bundleIdentifier),
        buildNumber: String(appRelease.ios.buildNumber),
      },
    },
    target: {
      channel,
      environment,
      requestedRolloutPercentage: rolloutPercentage,
    },
    classifier: {
      classification: classifierReport.classification,
      hasOtaPayload: classifierReport.hasOtaPayload,
      changedPathCount: classifierReport.files.length,
      policySha256: classifierReport.policySha256,
    },
    providerCommand: {
      executable: `eas-cli@${easCliVersion}`,
      operation: "eas update",
      outputFormat: "json",
    },
    provider,
    previewEvidence:
      validatedPreview === null
        ? null
        : {
            candidateSha: validatedPreview.manifest.source.candidateSha,
            manifestSha256: validatedPreview.sha256,
            workflowRunId: String(validatedPreview.manifest.source.workflowRunId || ""),
          },
    deviceEvidence:
      validatedDevice === null
        ? null
        : {
            manifestSha256: validatedDevice.sourceManifestSha256,
            previewUpdateGroupId: validatedDevice.previewUpdateGroupId,
            validationSha256: sha256(deviceValidationRaw),
          },
    artifacts,
    claims: {
      providerCommandCompleted: true,
      providerOutputValidatedAsJson: true,
      providerStateObserved: providerObservation.observed.groupId === provider.groupId,
      sameCommitPreviewEvidenceValidated: validatedPreview !== null,
      publishedBinaryOtaCapabilityVerified: false,
      runtimeDeviceVerified: validatedDevice !== null,
      updateCodeSigningVerified: false,
      rolloutHealthVerified: false,
      rollbackDrillVerified: false,
    },
  };
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (!argument.startsWith("--")) throw new Error(`Unexpected evidence argument: ${argument}`);
    index += 1;
    if (index >= args.length || args[index].startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2)] = args[index];
  }
  return options;
}

function requiredOption(options, name) {
  const value = String(options[name] || "").trim();
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

function gitTreeSha(candidateSha) {
  const result = spawnSync("git", ["rev-parse", `${candidateSha}^{tree}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Unable to resolve candidate git tree: ${String(result.stderr || "").trim()}`);
  }
  return result.stdout.trim().toLowerCase();
}

function writeEvidenceFromOptions(options) {
  const kind = requiredOption(options, "kind");
  const baseSha = requiredOption(options, "base").toLowerCase();
  const candidateSha = requiredOption(options, "head").toLowerCase();
  const classifierFile = path.resolve(requiredOption(options, "classifier-report"));
  const providerOutputFile = path.resolve(requiredOption(options, "provider-output"));
  const providerObservationFile = path.resolve(requiredOption(options, "provider-observation"));
  const outputFile = path.resolve(requiredOption(options, "output"));
  const outputDirectory = path.dirname(outputFile);
  const providerStderrFile = options["provider-stderr"]
    ? path.resolve(options["provider-stderr"])
    : "";
  const updateMetadataFile = path.resolve(requiredOption(options, "update-metadata"));
  const deviceValidationFile =
    kind === EVIDENCE_KIND.PRODUCTION
      ? path.resolve(requiredOption(options, "device-validation"))
      : "";

  for (const [label, filePath] of [
    ["classifier report", classifierFile],
    ["provider output", providerOutputFile],
    ["provider observation", providerObservationFile],
    ["update metadata", updateMetadataFile],
    ...(deviceValidationFile ? [["device validation", deviceValidationFile]] : []),
  ]) {
    if (!fs.existsSync(filePath)) throw new Error(`${label} file is missing: ${filePath}`);
    const relative = path.relative(outputDirectory, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${label} must be stored beside the evidence manifest.`);
    }
  }
  if (providerStderrFile && !fs.existsSync(providerStderrFile)) {
    throw new Error(`provider stderr file is missing: ${providerStderrFile}`);
  }

  let previewEvidence = null;
  if (kind === EVIDENCE_KIND.PRODUCTION) {
    previewEvidence = validatePreviewEvidence({
      manifestPath: path.resolve(requiredOption(options, "preview-manifest")),
      checksumPath: path.resolve(requiredOption(options, "preview-manifest-checksum")),
      candidateSha,
    });
  }

  const appRelease = JSON.parse(
    fs.readFileSync(path.resolve("config", "app-release.json"), "utf8"),
  );
  const classifierRaw = fs.readFileSync(classifierFile, "utf8");
  const providerOutputRaw = fs.readFileSync(providerOutputFile, "utf8");
  const providerObservationRaw = fs.readFileSync(providerObservationFile, "utf8");
  const updateMetadataRaw = fs.readFileSync(updateMetadataFile, "utf8");
  const deviceValidationRaw = deviceValidationFile
    ? fs.readFileSync(deviceValidationFile, "utf8")
    : undefined;
  const providerStderrRaw = providerStderrFile
    ? fs.readFileSync(providerStderrFile, "utf8")
    : undefined;
  const evidence = buildEvidence({
    appRelease,
    baseSha,
    candidateSha,
    channel: requiredOption(options, "channel"),
    classifierPath: path.relative(outputDirectory, classifierFile).replace(/\\/gu, "/"),
    classifierRaw,
    easCliVersion: requiredOption(options, "eas-cli-version"),
    environment: requiredOption(options, "environment"),
    generatedAt: new Date().toISOString(),
    gitTreeSha: gitTreeSha(candidateSha),
    kind,
    providerOutputPath: path.relative(outputDirectory, providerOutputFile).replace(/\\/gu, "/"),
    providerOutputRaw,
    providerObservationPath: path
      .relative(outputDirectory, providerObservationFile)
      .replace(/\\/gu, "/"),
    providerObservationRaw,
    providerStderrPath: providerStderrFile
      ? path.relative(outputDirectory, providerStderrFile).replace(/\\/gu, "/")
      : "",
    providerStderrRaw,
    updateMetadataPath: path.relative(outputDirectory, updateMetadataFile).replace(/\\/gu, "/"),
    updateMetadataRaw,
    repository: requiredOption(options, "repository"),
    rolloutPercentage: Number(requiredOption(options, "rollout-percentage")),
    workflowRunAttempt: requiredOption(options, "workflow-run-attempt"),
    workflowRunId: requiredOption(options, "workflow-run-id"),
    previewEvidence,
    deviceValidationPath: deviceValidationFile
      ? path.relative(outputDirectory, deviceValidationFile).replace(/\\/gu, "/")
      : "",
    deviceValidationRaw,
  });

  fs.mkdirSync(outputDirectory, { recursive: true });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  fs.writeFileSync(outputFile, serialized, "utf8");
  fs.writeFileSync(
    `${outputFile}.sha256`,
    `${sha256(serialized)}  ${path.basename(outputFile)}\n`,
    "utf8",
  );
  return evidence;
}

function printHelp() {
  console.log(`Usage: node utils/ops/write-ota-update-evidence.cjs --kind <preview|production> ...

The command validates the OTA classifier, real EAS publish and observation JSON, then writes a
same-SHA evidence manifest plus a SHA-256 sidecar. Production additionally requires downloaded
preview evidence and validated Android/iOS runtime-device evidence for the identical candidate.
`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printHelp();
  const evidence = writeEvidenceFromOptions(options);
  console.log(
    `[ota-evidence] OK: ${evidence.kind} evidence written for ${evidence.source.candidateSha}.`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      `[ota-evidence] FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  EVIDENCE_KIND,
  buildEvidence,
  parseJson,
  sha256,
  validateClassifierReport,
  validateDeviceValidationSummary,
  validatePreviewEvidence,
  validateProviderObservationSummary,
  writeEvidenceFromOptions,
};
