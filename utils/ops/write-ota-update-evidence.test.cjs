const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const {
  buildEvidence,
  sha256,
  validatePreviewEvidence,
} = require("./write-ota-update-evidence.cjs");

const BASE_SHA = "a".repeat(40);
const CANDIDATE_SHA = "b".repeat(40);
const TREE_SHA = "c".repeat(40);
const PREVIEW_GROUP_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCTION_GROUP_ID = "55555555-5555-4555-8555-555555555555";
const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop(), { force: true, recursive: true });
  }
});

function providerUpdates(kind) {
  const group = kind === "production" ? PRODUCTION_GROUP_ID : PREVIEW_GROUP_ID;
  return ["android", "ios"].map((platform, index) => ({
    id:
      kind === "production"
        ? `${index + 6}6666666-6666-4666-8666-666666666666`
        : `${index + 2}2222222-2222-4222-8222-222222222222`,
    createdAt: "2026-08-30T12:00:00.000Z",
    group,
    branch: kind,
    message: `${kind} ${CANDIDATE_SHA}: existing feature fix`,
    runtimeVersion: "1.0.133",
    platform,
    manifestPermalink: `https://u.expo.dev/example/${platform}`,
    isRollBackToEmbedded: false,
    gitCommitHash: CANDIDATE_SHA,
  }));
}

function providerIdentity(kind) {
  const updates = providerUpdates(kind);
  return {
    branch: kind,
    candidateSha: CANDIDATE_SHA,
    groupId: updates[0].group,
    message: updates[0].message,
    platforms: Object.fromEntries(
      updates.map((update) => [
        update.platform,
        { id: update.id, manifestPermalink: update.manifestPermalink },
      ]),
    ),
    runtimeVersion: "1.0.133",
  };
}

function providerObservation(kind) {
  const provider = providerIdentity(kind);
  return {
    schemaVersion: 1,
    kind: "eas-update-provider-observation",
    generatedAt: "2026-08-30T12:05:00.000Z",
    provider,
    observed: {
      branch: kind,
      candidateSha: CANDIDATE_SHA,
      channel: kind,
      groupId: provider.groupId,
      rolloutPercentage: kind === "production" ? 5 : 100,
      runtimeVersion: "1.0.133",
    },
  };
}

function deviceValidation() {
  return {
    schemaVersion: 1,
    kind: "validated-preview-runtime-device-evidence",
    candidateSha: CANDIDATE_SHA,
    runtimeVersion: "1.0.133",
    previewUpdateGroupId: PREVIEW_GROUP_ID,
    sourceManifestSha256: "8".repeat(64),
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

function fixtureOptions(overrides = {}) {
  const kind = overrides.kind || "preview";
  const classifierReport = {
    schemaVersion: 1,
    baseSha: BASE_SHA,
    headSha: CANDIDATE_SHA,
    headTreeSha: TREE_SHA,
    classification: "OTA_SAFE",
    hasOtaPayload: true,
    policySha256: "e".repeat(64),
    files: [{ path: "src/mobile/app/example.ts", classification: "OTA_SAFE" }],
  };
  return {
    appRelease: {
      version: "1.0.133",
      runtimeVersion: "1.0.133",
      android: { package: "com.ogrencisosyalagi.app", versionCode: 133 },
      ios: { bundleIdentifier: "com.ogrencisosyalagi.app", buildNumber: "133" },
    },
    baseSha: BASE_SHA,
    candidateSha: CANDIDATE_SHA,
    channel: kind,
    classifierPath: "classifier.json",
    classifierRaw: JSON.stringify(classifierReport),
    easCliVersion: "23.0.0",
    environment: kind,
    generatedAt: "2026-08-30T12:00:00.000Z",
    gitTreeSha: TREE_SHA,
    kind,
    providerOutputPath: "eas-update.json",
    providerOutputRaw: JSON.stringify(providerUpdates(kind)),
    providerObservationPath: "provider-observation.json",
    providerObservationRaw: JSON.stringify(providerObservation(kind)),
    providerStderrPath: "eas-update.stderr.log",
    providerStderrRaw: "provider diagnostic\n",
    updateMetadataPath: "eas-update-metadata.json",
    updateMetadataRaw: JSON.stringify({ updates: providerUpdates(kind) }),
    repository: "cayankuzu/UniVerse",
    rolloutPercentage: kind === "production" ? 5 : 100,
    workflowRunAttempt: "1",
    workflowRunId: "1234",
    previewEvidence: null,
    deviceValidationPath: kind === "production" ? "device-validation.json" : "",
    deviceValidationRaw: kind === "production" ? JSON.stringify(deviceValidation()) : undefined,
    ...overrides,
  };
}

function writePreviewEvidenceFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "universe-ota-evidence-"));
  temporaryDirectories.push(directory);
  const classifierRaw = fixtureOptions().classifierRaw;
  const providerOutputRaw = fixtureOptions().providerOutputRaw;
  const providerObservationRaw = fixtureOptions().providerObservationRaw;
  const updateMetadataRaw = fixtureOptions().updateMetadataRaw;
  fs.writeFileSync(path.join(directory, "classifier.json"), classifierRaw, "utf8");
  fs.writeFileSync(path.join(directory, "eas-update.json"), providerOutputRaw, "utf8");
  fs.writeFileSync(
    path.join(directory, "provider-observation.json"),
    providerObservationRaw,
    "utf8",
  );
  fs.writeFileSync(path.join(directory, "eas-update-metadata.json"), updateMetadataRaw, "utf8");
  const manifest = buildEvidence(fixtureOptions());
  const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestPath = path.join(directory, "manifest.json");
  const checksumPath = path.join(directory, "manifest.json.sha256");
  fs.writeFileSync(manifestPath, manifestRaw, "utf8");
  fs.writeFileSync(checksumPath, `${sha256(manifestRaw)}  manifest.json\n`, "utf8");
  return { checksumPath, directory, manifest, manifestPath };
}

test("builds preview evidence without claiming device, signing, health, or rollback proof", () => {
  const evidence = buildEvidence(fixtureOptions());
  assert.equal(evidence.kind, "preview");
  assert.equal(evidence.source.candidateSha, CANDIDATE_SHA);
  assert.equal(evidence.release.runtimeVersion, "1.0.133");
  assert.equal(evidence.target.requestedRolloutPercentage, 100);
  assert.equal(evidence.claims.providerCommandCompleted, true);
  assert.equal(evidence.claims.providerStateObserved, true);
  assert.equal(evidence.claims.runtimeDeviceVerified, false);
  assert.equal(evidence.claims.updateCodeSigningVerified, false);
  assert.equal(evidence.claims.rolloutHealthVerified, false);
  assert.equal(evidence.claims.rollbackDrillVerified, false);
});

test("rejects classifier reports that are blocked, empty, or tied to a different SHA", () => {
  for (const classifier of [
    {
      schemaVersion: 1,
      baseSha: BASE_SHA,
      headSha: CANDIDATE_SHA,
      classification: "NATIVE_BUILD_REQUIRED",
      hasOtaPayload: true,
      files: [{}],
    },
    {
      schemaVersion: 1,
      baseSha: BASE_SHA,
      headSha: CANDIDATE_SHA,
      classification: "OTA_SAFE",
      hasOtaPayload: false,
      files: [],
    },
    {
      schemaVersion: 1,
      baseSha: BASE_SHA,
      headSha: "d".repeat(40),
      classification: "OTA_SAFE",
      hasOtaPayload: true,
      files: [{}],
    },
  ]) {
    assert.throws(
      () => buildEvidence(fixtureOptions({ classifierRaw: JSON.stringify(classifier) })),
      /Classifier evidence/u,
    );
  }
});

test("rejects malformed provider JSON and provider responses missing a platform", () => {
  assert.throws(
    () => buildEvidence(fixtureOptions({ providerOutputRaw: "not json" })),
    /not valid JSON/u,
  );
  assert.throws(
    () =>
      buildEvidence(
        fixtureOptions({
          providerOutputRaw: JSON.stringify(providerUpdates("preview").slice(0, 1)),
        }),
      ),
    /exactly Android and iOS/u,
  );
});

test("enforces isolated targets and the fixed initial rollout percentages", () => {
  assert.throws(
    () => buildEvidence(fixtureOptions({ environment: "production" })),
    /isolated preview/u,
  );
  assert.throws(
    () => buildEvidence(fixtureOptions({ rolloutPercentage: 99 })),
    /initial 100% rollout/u,
  );
  assert.throws(
    () =>
      buildEvidence(
        fixtureOptions({
          kind: "production",
          channel: "production",
          environment: "production",
          rolloutPercentage: 100,
        }),
      ),
    /initial 5% rollout/u,
  );
});

test("validates downloaded preview checksums and referenced artifacts", () => {
  const fixture = writePreviewEvidenceFixture();
  const validated = validatePreviewEvidence({
    manifestPath: fixture.manifestPath,
    checksumPath: fixture.checksumPath,
    candidateSha: CANDIDATE_SHA,
  });
  assert.equal(validated.sha256, sha256(fs.readFileSync(fixture.manifestPath)));
  assert.equal(validated.manifest.kind, "preview");

  fs.appendFileSync(path.join(fixture.directory, "classifier.json"), "tampered", "utf8");
  assert.throws(
    () =>
      validatePreviewEvidence({
        manifestPath: fixture.manifestPath,
        checksumPath: fixture.checksumPath,
        candidateSha: CANDIDATE_SHA,
      }),
    /artifact checksum mismatch/u,
  );
});

test("production evidence requires validated preview evidence for the identical commit", () => {
  const fixture = writePreviewEvidenceFixture();
  const previewEvidence = validatePreviewEvidence({
    manifestPath: fixture.manifestPath,
    checksumPath: fixture.checksumPath,
    candidateSha: CANDIDATE_SHA,
  });
  const production = buildEvidence(
    fixtureOptions({
      kind: "production",
      channel: "production",
      environment: "production",
      previewEvidence,
    }),
  );
  assert.equal(production.claims.sameCommitPreviewEvidenceValidated, true);
  assert.equal(production.previewEvidence.candidateSha, CANDIDATE_SHA);

  assert.throws(
    () =>
      buildEvidence(
        fixtureOptions({
          kind: "production",
          channel: "production",
          environment: "production",
          previewEvidence: null,
        }),
      ),
    /requires same-SHA preview evidence/u,
  );
});
