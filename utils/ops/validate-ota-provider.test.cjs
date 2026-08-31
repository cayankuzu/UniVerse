const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  validateGeneratedMetadata,
  validateNoDuplicateCandidate,
  validateProviderObservation,
  validatePublishedUpdates,
} = require("./validate-ota-provider.cjs");

const CANDIDATE_SHA = "b".repeat(40);
const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const RUNTIME_VERSION = "1.0.133";
const MESSAGE = `production ${CANDIDATE_SHA}: existing feature fix`;

function providerUpdates(overrides = {}) {
  return ["android", "ios"].map((platform, index) => ({
    id: `${index + 2}2222222-2222-4222-8222-222222222222`,
    createdAt: "2026-08-30T12:00:00.000Z",
    group: GROUP_ID,
    branch: "production",
    message: MESSAGE,
    runtimeVersion: RUNTIME_VERSION,
    platform,
    manifestPermalink: `https://u.expo.dev/example/${platform}`,
    isRollBackToEmbedded: false,
    gitCommitHash: CANDIDATE_SHA,
    ...overrides,
  }));
}

function expected(overrides = {}) {
  return {
    branch: "production",
    candidateSha: CANDIDATE_SHA,
    expectedMessage: MESSAGE,
    kind: "production",
    runtimeVersion: RUNTIME_VERSION,
    ...overrides,
  };
}

function listOutput(overrides = {}) {
  return JSON.stringify({
    name: "production",
    currentPage: [
      {
        branch: "production",
        message: `[Aug 30 12:00 by robot, runtimeVersion: ${RUNTIME_VERSION}] ${MESSAGE}`,
        runtimeVersion: RUNTIME_VERSION,
        rolloutPercentage: 5,
        group: GROUP_ID,
        platforms: "Android, iOS",
        ...overrides,
      },
    ],
  });
}

function channelOutput(overrides = {}) {
  return JSON.stringify({
    currentPage: {
      id: "channel-id",
      name: "production",
      isPaused: false,
      updateBranches: [{ id: "branch-id", name: "production", updateGroups: [] }],
      ...overrides,
    },
  });
}

test("validates the real EAS publish JSON shape for one common Android/iOS group", () => {
  const identity = validatePublishedUpdates(JSON.stringify(providerUpdates()), expected());
  assert.equal(identity.groupId, GROUP_ID);
  assert.deepEqual(Object.keys(identity.platforms).sort(), ["android", "ios"]);
  assert.equal(identity.platforms.android.id, providerUpdates()[0].id);

  const metadata = JSON.stringify({ updates: providerUpdates() });
  assert.equal(validateGeneratedMetadata(metadata, expected(), identity).groupId, GROUP_ID);
});

test("rejects missing platforms, split groups, wrong runtime, branch, SHA, or message", () => {
  const invalidCases = [
    providerUpdates().slice(0, 1),
    providerUpdates().map((item, index) =>
      index === 1 ? { ...item, group: "33333333-3333-4333-8333-333333333333" } : item,
    ),
    providerUpdates().map((item, index) =>
      index === 1 ? { ...item, runtimeVersion: "1.0.132" } : item,
    ),
    providerUpdates().map((item) => ({ ...item, branch: "preview" })),
    providerUpdates().map((item) => ({ ...item, gitCommitHash: "c".repeat(40) })),
    providerUpdates().map((item) => ({ ...item, message: "unbound update" })),
  ];
  for (const invalid of invalidCases) {
    assert.throws(
      () => validatePublishedUpdates(JSON.stringify(invalid), expected()),
      /EAS|provider/u,
    );
  }
});

test("metadata must describe the exact provider update IDs", () => {
  const identity = validatePublishedUpdates(JSON.stringify(providerUpdates()), expected());
  const changed = providerUpdates().map((item, index) =>
    index === 0 ? { ...item, id: "44444444-4444-4444-8444-444444444444" } : item,
  );
  assert.throws(
    () => validateGeneratedMetadata(JSON.stringify({ updates: changed }), expected(), identity),
    /do not match/u,
  );
});

test("preflight fails closed when the exact candidate already exists", () => {
  assert.throws(
    () => validateNoDuplicateCandidate(listOutput(), expected()),
    /refusing a duplicate publish/u,
  );
  assert.deepEqual(validateNoDuplicateCandidate(JSON.stringify({ currentPage: [] }), expected()), {
    checkedGroups: 0,
  });
});

test("post-publish observation requires 5%, both platforms, and an active linked channel", () => {
  const observed = validateProviderObservation(
    { channelRaw: channelOutput(), listRaw: listOutput() },
    { ...expected(), groupId: GROUP_ID, rolloutPercentage: 5 },
  );
  assert.equal(observed.rolloutPercentage, 5);

  assert.throws(
    () =>
      validateProviderObservation(
        { channelRaw: channelOutput(), listRaw: listOutput({ rolloutPercentage: 10 }) },
        { ...expected(), groupId: GROUP_ID, rolloutPercentage: 5 },
      ),
    /exactly 5 percent/u,
  );
  assert.throws(
    () =>
      validateProviderObservation(
        { channelRaw: channelOutput(), listRaw: listOutput({ platforms: "Android" }) },
        { ...expected(), groupId: GROUP_ID, rolloutPercentage: 5 },
      ),
    /both Android and iOS/u,
  );
  assert.throws(
    () =>
      validateProviderObservation(
        { channelRaw: channelOutput({ isPaused: true }), listRaw: listOutput() },
        { ...expected(), groupId: GROUP_ID, rolloutPercentage: 5 },
      ),
    /missing or paused/u,
  );
});
