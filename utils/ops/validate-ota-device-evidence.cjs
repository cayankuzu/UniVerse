#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { parseJson, validatePreviewEvidence } = require("./write-ota-update-evidence.cjs");

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PLATFORMS = Object.freeze(["android", "ios"]);
const REQUIRED_CHECKS = Object.freeze([
  "updateApplied",
  "coldLaunch",
  "warmLaunch",
  "offlineLaunch",
  "criticalFlows",
]);
const FORBIDDEN_IDENTITY_KEYS =
  /^(?:advertisingId|deviceId|email|imei|serialNumber|udid|userId|username)$/iu;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeReference(value, label) {
  const reference = String(value || "").trim();
  const hasControlCharacter = [...reference].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (
    reference.length > 512 ||
    hasControlCharacter ||
    !/^(?:artifact|github-actions|https):\/\/[^\s]+$/u.test(reference)
  ) {
    throw new Error(`${label} must be an immutable artifact or HTTPS reference.`);
  }
  if (reference.startsWith("https://")) {
    const url = new URL(reference);
    if (url.username || url.password) throw new Error(`${label} must not contain credentials.`);
  }
}

function rejectIdentityFields(value, location = "device evidence") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_IDENTITY_KEYS.test(key)) {
      throw new Error(`${location} contains prohibited identity field ${key}.`);
    }
    rejectIdentityFields(child, `${location}.${key}`);
  }
}

function readChecks(platform, platformName) {
  for (const check of REQUIRED_CHECKS) {
    if (platform?.checks?.[check] !== true) {
      throw new Error(`${platformName} device evidence must pass ${check}.`);
    }
  }
  if (
    !Array.isArray(platform.criticalFlowReferences) ||
    platform.criticalFlowReferences.length === 0
  ) {
    throw new Error(`${platformName} device evidence must list critical flow references.`);
  }
  for (const reference of platform.criticalFlowReferences) {
    assertSafeReference(reference, `${platformName} critical flow reference`);
  }
}

function readBinaryEvidence(raw, runtimeVersion) {
  const evidence = parseJson(raw, "Published-binary OTA evidence");
  if (evidence.schemaVersion !== 1 || evidence.kind !== "published-binary-ota-capability") {
    throw new Error("Published-binary OTA evidence schema or kind is invalid.");
  }
  const hashes = {};
  for (const platform of PLATFORMS) {
    const item = evidence.platforms?.[platform];
    if (!item || item.runtimeVersion !== runtimeVersion) {
      throw new Error(`${platform} published-binary runtimeVersion mismatch.`);
    }
    const artifactSha256 = String(item.artifactSha256 || "").toLowerCase();
    if (!SHA256_PATTERN.test(artifactSha256)) {
      throw new Error(`${platform} published-binary artifact SHA-256 is invalid.`);
    }
    hashes[platform] = artifactSha256;
  }
  return hashes;
}

function validateDeviceEvidence({
  binaryEvidencePath,
  candidateSha,
  checksumPath,
  manifestPath,
  now = new Date(),
  previewChecksumPath,
  previewManifestPath,
  runtimeVersion,
}) {
  const normalizedCandidate = String(candidateSha || "").toLowerCase();
  if (!FULL_SHA_PATTERN.test(normalizedCandidate)) {
    throw new Error("Device evidence candidate SHA must be a full SHA.");
  }
  if (!String(runtimeVersion || "").trim()) throw new Error("Device evidence runtime is required.");

  const manifestRaw = fs.readFileSync(path.resolve(manifestPath));
  const expectedChecksum = fs
    .readFileSync(path.resolve(checksumPath), "utf8")
    .trim()
    .split(/\s+/u)[0];
  const manifestSha256 = sha256(manifestRaw);
  if (!SHA256_PATTERN.test(expectedChecksum) || expectedChecksum !== manifestSha256) {
    throw new Error("Device evidence manifest checksum is invalid or does not match.");
  }
  const manifest = parseJson(manifestRaw.toString("utf8"), "Preview device evidence manifest");
  rejectIdentityFields(manifest);

  const preview = validatePreviewEvidence({
    candidateSha: normalizedCandidate,
    checksumPath: path.resolve(previewChecksumPath),
    manifestPath: path.resolve(previewManifestPath),
  });
  const previewGroupId = String(preview.manifest?.provider?.groupId || "").toLowerCase();
  if (!UUID_PATTERN.test(previewGroupId)) {
    throw new Error("Preview manifest does not contain a validated provider group ID.");
  }
  const binaryRaw = fs.readFileSync(path.resolve(binaryEvidencePath), "utf8");
  const binaryHashes = readBinaryEvidence(binaryRaw, runtimeVersion);

  if (manifest.schemaVersion !== 1 || manifest.kind !== "preview-runtime-device-evidence") {
    throw new Error("Preview device evidence schema or kind is invalid.");
  }
  if (String(manifest.candidateSha || "").toLowerCase() !== normalizedCandidate) {
    throw new Error("Preview device evidence candidate SHA mismatch.");
  }
  if (manifest.runtimeVersion !== runtimeVersion) {
    throw new Error("Preview device evidence runtimeVersion mismatch.");
  }
  if (String(manifest.previewUpdateGroupId || "").toLowerCase() !== previewGroupId) {
    throw new Error("Preview device evidence update group mismatch.");
  }
  if (String(manifest.previewManifestSha256 || "").toLowerCase() !== preview.sha256) {
    throw new Error("Preview device evidence is not bound to the downloaded preview manifest.");
  }

  const recordedAt = Date.parse(String(manifest.recordedAt || ""));
  const previewGeneratedAt = Date.parse(String(preview.manifest.generatedAt || ""));
  if (
    !Number.isFinite(recordedAt) ||
    !Number.isFinite(previewGeneratedAt) ||
    recordedAt < previewGeneratedAt ||
    recordedAt > now.getTime() + 5 * 60 * 1000
  ) {
    throw new Error(
      "Preview device evidence timestamp must follow preview publication and not be future-dated.",
    );
  }

  const platforms = {};
  for (const platformName of PLATFORMS) {
    const platform = manifest.platforms?.[platformName];
    if (!platform || typeof platform !== "object" || Array.isArray(platform)) {
      throw new Error(`${platformName} preview device evidence is required.`);
    }
    const observedUpdateId = String(platform.observedUpdateId || "").toLowerCase();
    const expectedUpdateId = String(
      preview.manifest?.provider?.platforms?.[platformName]?.id || "",
    ).toLowerCase();
    if (!UUID_PATTERN.test(observedUpdateId) || observedUpdateId !== expectedUpdateId) {
      throw new Error(
        `${platformName} observed update ID does not match preview provider evidence.`,
      );
    }
    if (String(platform.observedUpdateGroupId || "").toLowerCase() !== previewGroupId) {
      throw new Error(`${platformName} observed update group does not match preview.`);
    }
    const installedBinarySha256 = String(platform.installedBinarySha256 || "").toLowerCase();
    if (installedBinarySha256 !== binaryHashes[platformName]) {
      throw new Error(
        `${platformName} installed binary hash does not match binary inspection evidence.`,
      );
    }
    const testArtifactSha256 = String(platform.testArtifactSha256 || "").toLowerCase();
    if (!SHA256_PATTERN.test(testArtifactSha256)) {
      throw new Error(`${platformName} device test artifact SHA-256 is invalid.`);
    }
    assertSafeReference(platform.installedBinaryReference, `${platformName} installed binary`);
    assertSafeReference(platform.testArtifactReference, `${platformName} device test artifact`);
    if (!String(platform.deviceModel || "").trim() || !String(platform.osVersion || "").trim()) {
      throw new Error(`${platformName} device model and OS version are required.`);
    }
    readChecks(platform, platformName);
    platforms[platformName] = {
      installedBinarySha256,
      observedUpdateId,
      testArtifactSha256,
    };
  }

  return {
    schemaVersion: 1,
    kind: "validated-preview-runtime-device-evidence",
    generatedAt: now.toISOString(),
    candidateSha: normalizedCandidate,
    runtimeVersion,
    previewUpdateGroupId: previewGroupId,
    previewManifestSha256: preview.sha256,
    sourceManifestSha256: manifestSha256,
    binaryEvidenceSha256: sha256(binaryRaw),
    platforms,
    claims: {
      androidDeviceVerified: true,
      iosDeviceVerified: true,
      updateAppliedVerified: true,
      coldLaunchVerified: true,
      warmLaunchVerified: true,
      offlineLaunchVerified: true,
      criticalFlowsVerified: true,
    },
  };
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    index += 1;
    if (index >= args.length || args[index].startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2)] = args[index];
  }
  return options;
}

function required(options, name) {
  const value = String(options[name] || "").trim();
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

function run(options) {
  const result = validateDeviceEvidence({
    binaryEvidencePath: required(options, "binary-evidence"),
    candidateSha: required(options, "candidate"),
    checksumPath: required(options, "checksum"),
    manifestPath: required(options, "manifest"),
    previewChecksumPath: required(options, "preview-checksum"),
    previewManifestPath: required(options, "preview-manifest"),
    runtimeVersion: required(options, "runtime-version"),
  });
  const outputPath = path.resolve(required(options, "output"));
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, "utf8");
  fs.writeFileSync(`${outputPath}.sha256`, `${sha256(serialized)}  ${path.basename(outputPath)}\n`);
  console.log(`[ota-device] OK: validated Android and iOS for ${result.candidateSha}.`);
  return result;
}

if (require.main === module) {
  try {
    run(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(`[ota-device] FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  REQUIRED_CHECKS,
  assertSafeReference,
  rejectIdentityFields,
  run,
  sha256,
  validateDeviceEvidence,
};
