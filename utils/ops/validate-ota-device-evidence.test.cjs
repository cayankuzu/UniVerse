const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { buildEvidence, sha256 } = require("./write-ota-update-evidence.cjs");
const { validateDeviceEvidence } = require("./validate-ota-device-evidence.cjs");

const BASE_SHA = "a".repeat(40);
const CANDIDATE_SHA = "b".repeat(40);
const TREE_SHA = "c".repeat(40);
const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop(), { force: true, recursive: true });
  }
});

function updates() {
  return ["android", "ios"].map((platform, index) => ({
    id: `${index + 2}2222222-2222-4222-8222-222222222222`,
    createdAt: "2026-08-30T12:00:00.000Z",
    group: GROUP_ID,
    branch: "preview",
    message: `preview ${CANDIDATE_SHA}: existing feature fix`,
    runtimeVersion: "1.0.133",
    platform,
    manifestPermalink: `https://u.expo.dev/example/${platform}`,
    isRollBackToEmbedded: false,
    gitCommitHash: CANDIDATE_SHA,
  }));
}

function previewFixture(directory) {
  const classifier = JSON.stringify({
    schemaVersion: 1,
    baseSha: BASE_SHA,
    headSha: CANDIDATE_SHA,
    headTreeSha: TREE_SHA,
    classification: "OTA_SAFE",
    hasOtaPayload: true,
    policySha256: "d".repeat(64),
    files: [{ path: "src/mobile/app/example.ts", classification: "OTA_SAFE" }],
  });
  const provider = {
    branch: "preview",
    candidateSha: CANDIDATE_SHA,
    groupId: GROUP_ID,
    message: updates()[0].message,
    platforms: Object.fromEntries(
      updates().map((item) => [
        item.platform,
        { id: item.id, manifestPermalink: item.manifestPermalink },
      ]),
    ),
    runtimeVersion: "1.0.133",
  };
  const files = {
    "classifier.json": classifier,
    "eas-update.json": JSON.stringify(updates()),
    "eas-update-metadata.json": JSON.stringify({ updates: updates() }),
    "provider-observation.json": JSON.stringify({
      schemaVersion: 1,
      kind: "eas-update-provider-observation",
      provider,
      observed: {
        branch: "preview",
        candidateSha: CANDIDATE_SHA,
        channel: "preview",
        groupId: GROUP_ID,
        rolloutPercentage: 100,
        runtimeVersion: "1.0.133",
      },
    }),
  };
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), content, "utf8");
  }
  const manifest = buildEvidence({
    appRelease: {
      version: "1.0.133",
      runtimeVersion: "1.0.133",
      android: { package: "com.ogrencisosyalagi.app", versionCode: 133 },
      ios: { bundleIdentifier: "com.ogrencisosyalagi.app", buildNumber: "133" },
    },
    baseSha: BASE_SHA,
    candidateSha: CANDIDATE_SHA,
    channel: "preview",
    classifierPath: "classifier.json",
    classifierRaw: files["classifier.json"],
    easCliVersion: "23.0.0",
    environment: "preview",
    generatedAt: "2026-08-30T12:05:00.000Z",
    gitTreeSha: TREE_SHA,
    kind: "preview",
    providerOutputPath: "eas-update.json",
    providerOutputRaw: files["eas-update.json"],
    providerObservationPath: "provider-observation.json",
    providerObservationRaw: files["provider-observation.json"],
    updateMetadataPath: "eas-update-metadata.json",
    updateMetadataRaw: files["eas-update-metadata.json"],
    repository: "cayankuzu/UniVerse",
    rolloutPercentage: 100,
    workflowRunAttempt: "1",
    workflowRunId: "1234",
  });
  const raw = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestPath = path.join(directory, "preview-manifest.json");
  const checksumPath = `${manifestPath}.sha256`;
  fs.writeFileSync(manifestPath, raw, "utf8");
  fs.writeFileSync(checksumPath, `${sha256(raw)}  preview-manifest.json\n`, "utf8");
  return { checksumPath, manifest, manifestPath };
}

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "universe-ota-device-"));
  temporaryDirectories.push(directory);
  const preview = previewFixture(directory);
  const binary = {
    schemaVersion: 1,
    kind: "published-binary-ota-capability",
    platforms: {
      android: { runtimeVersion: "1.0.133", artifactSha256: "a".repeat(64) },
      ios: { runtimeVersion: "1.0.133", artifactSha256: "b".repeat(64) },
    },
  };
  const binaryEvidencePath = path.join(directory, "binary.json");
  fs.writeFileSync(binaryEvidencePath, JSON.stringify(binary), "utf8");
  const platformEvidence = (platform, index) => ({
    observedUpdateId: updates()[index].id,
    observedUpdateGroupId: GROUP_ID,
    installedBinarySha256: binary.platforms[platform].artifactSha256,
    installedBinaryReference: `artifact://store-binary/${platform}/133`,
    testArtifactSha256: (platform === "android" ? "c" : "d").repeat(64),
    testArtifactReference: `github-actions://device-run/${platform}/evidence.zip`,
    deviceModel: platform === "android" ? "Pixel 9" : "iPhone 16",
    osVersion: platform === "android" ? "Android 16" : "iOS 19",
    criticalFlowReferences: [`artifact://device-run/${platform}/critical-flows.log`],
    checks: {
      updateApplied: true,
      coldLaunch: true,
      warmLaunch: true,
      offlineLaunch: true,
      criticalFlows: true,
    },
  });
  const manifest = {
    schemaVersion: 1,
    kind: "preview-runtime-device-evidence",
    candidateSha: CANDIDATE_SHA,
    runtimeVersion: "1.0.133",
    previewUpdateGroupId: GROUP_ID,
    previewManifestSha256: sha256(fs.readFileSync(preview.manifestPath)),
    recordedAt: "2026-08-30T12:30:00.000Z",
    platforms: {
      android: platformEvidence("android", 0),
      ios: platformEvidence("ios", 1),
    },
  };
  const manifestPath = path.join(directory, "device-manifest.json");
  const checksumPath = `${manifestPath}.sha256`;
  function writeDevice(value = manifest) {
    const raw = `${JSON.stringify(value, null, 2)}\n`;
    fs.writeFileSync(manifestPath, raw, "utf8");
    fs.writeFileSync(checksumPath, `${sha256(raw)}  device-manifest.json\n`, "utf8");
  }
  writeDevice();
  return {
    binaryEvidencePath,
    checksumPath,
    directory,
    manifest,
    manifestPath,
    preview,
    writeDevice,
  };
}

function validate(fixtureValue) {
  return validateDeviceEvidence({
    binaryEvidencePath: fixtureValue.binaryEvidencePath,
    candidateSha: CANDIDATE_SHA,
    checksumPath: fixtureValue.checksumPath,
    manifestPath: fixtureValue.manifestPath,
    now: new Date("2026-08-30T13:00:00.000Z"),
    previewChecksumPath: fixtureValue.preview.checksumPath,
    previewManifestPath: fixtureValue.preview.manifestPath,
    runtimeVersion: "1.0.133",
  });
}

test("accepts immutable same-SHA Android and iOS preview device evidence", () => {
  const value = validate(fixture());
  assert.equal(value.previewUpdateGroupId, GROUP_ID);
  assert.equal(value.claims.androidDeviceVerified, true);
  assert.equal(value.claims.iosDeviceVerified, true);
  assert.equal(value.claims.offlineLaunchVerified, true);
});

test("rejects a missing platform or any failed required device check", () => {
  const missingIos = fixture();
  missingIos.writeDevice({
    ...missingIos.manifest,
    platforms: { android: missingIos.manifest.platforms.android },
  });
  assert.throws(() => validate(missingIos), /ios preview device evidence is required/u);

  const failedOffline = fixture();
  failedOffline.manifest.platforms.ios.checks.offlineLaunch = false;
  failedOffline.writeDevice();
  assert.throws(() => validate(failedOffline), /ios device evidence must pass offlineLaunch/u);
});

test("rejects evidence for another update, runtime, binary, or unbound artifact", () => {
  const wrongUpdate = fixture();
  wrongUpdate.manifest.platforms.android.observedUpdateId = "99999999-9999-4999-8999-999999999999";
  wrongUpdate.writeDevice();
  assert.throws(() => validate(wrongUpdate), /does not match preview provider evidence/u);

  const wrongRuntime = fixture();
  wrongRuntime.manifest.runtimeVersion = "1.0.132";
  wrongRuntime.writeDevice();
  assert.throws(() => validate(wrongRuntime), /runtimeVersion mismatch/u);

  const wrongBinary = fixture();
  wrongBinary.manifest.platforms.ios.installedBinarySha256 = "e".repeat(64);
  wrongBinary.writeDevice();
  assert.throws(() => validate(wrongBinary), /installed binary hash/u);

  const missingArtifact = fixture();
  missingArtifact.manifest.platforms.android.testArtifactReference = "local-file.zip";
  missingArtifact.writeDevice();
  assert.throws(() => validate(missingArtifact), /immutable artifact or HTTPS reference/u);
});

test("rejects checksum tampering and prohibited device identity fields", () => {
  const tampered = fixture();
  fs.appendFileSync(tampered.manifestPath, "tampered", "utf8");
  assert.throws(() => validate(tampered), /checksum/u);

  const pii = fixture();
  pii.manifest.platforms.android.deviceId = "raw-device-id";
  pii.writeDevice();
  assert.throws(() => validate(pii), /prohibited identity field deviceId/u);
});
