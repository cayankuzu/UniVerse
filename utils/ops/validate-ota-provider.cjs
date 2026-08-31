#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PLATFORM_NAMES = Object.freeze(["android", "ios"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseNonEmptyJson(raw, label) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    parsed === null ||
    (Array.isArray(parsed) && parsed.length === 0) ||
    (!Array.isArray(parsed) && typeof parsed === "object" && Object.keys(parsed).length === 0)
  ) {
    throw new Error(`${label} must contain a non-empty provider response.`);
  }
  return parsed;
}

function assertExpectedIdentity({ branch, candidateSha, kind, runtimeVersion }) {
  if (!FULL_SHA_PATTERN.test(candidateSha)) throw new Error("candidate SHA must be a full SHA.");
  if (kind !== "preview" && kind !== "production") {
    throw new Error("provider target kind must be preview or production.");
  }
  if (branch !== kind) throw new Error(`${kind} provider output must use branch ${kind}.`);
  if (!String(runtimeVersion || "").trim()) throw new Error("runtimeVersion is required.");
}

function assertSafeHttpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error(`${label} must be a credential-free HTTPS URL.`);
  }
}

function validatePublishedUpdates(
  rawOrValue,
  { branch, candidateSha, expectedMessage, kind, runtimeVersion },
) {
  assertExpectedIdentity({ branch, candidateSha, kind, runtimeVersion });
  const updates =
    typeof rawOrValue === "string"
      ? parseNonEmptyJson(rawOrValue, "EAS update provider output")
      : rawOrValue;
  if (!Array.isArray(updates) || updates.length !== PLATFORM_NAMES.length) {
    throw new Error("EAS update provider output must contain exactly Android and iOS updates.");
  }

  const expectedPrefix = `${kind} ${candidateSha}: `;
  const expectedPlatforms = new Set(PLATFORM_NAMES);
  const groups = new Set();
  const ids = new Set();
  const byPlatform = {};
  for (const update of updates) {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new Error("Each EAS update provider record must be an object.");
    }
    const platform = String(update.platform || "").toLowerCase();
    if (!expectedPlatforms.delete(platform)) {
      throw new Error(
        `EAS update provider output has an unexpected or duplicate platform: ${platform}.`,
      );
    }
    if (!UUID_PATTERN.test(String(update.id || ""))) {
      throw new Error(`${platform} EAS update ID is invalid.`);
    }
    if (!UUID_PATTERN.test(String(update.group || ""))) {
      throw new Error(`${platform} EAS update group ID is invalid.`);
    }
    ids.add(String(update.id).toLowerCase());
    groups.add(String(update.group).toLowerCase());
    if (update.branch !== branch) throw new Error(`${platform} EAS branch mismatch.`);
    if (update.runtimeVersion !== runtimeVersion) {
      throw new Error(`${platform} EAS runtimeVersion mismatch.`);
    }
    if (String(update.gitCommitHash || "").toLowerCase() !== candidateSha) {
      throw new Error(`${platform} EAS gitCommitHash does not match the immutable candidate.`);
    }
    if (
      typeof update.message !== "string" ||
      !update.message.startsWith(expectedPrefix) ||
      (expectedMessage !== undefined && update.message !== expectedMessage)
    ) {
      throw new Error(`${platform} EAS update message is not tied to the candidate SHA.`);
    }
    if (update.isRollBackToEmbedded !== false) {
      throw new Error(
        `${platform} provider record is a rollback rather than the candidate update.`,
      );
    }
    if (!Number.isFinite(Date.parse(String(update.createdAt || "")))) {
      throw new Error(`${platform} EAS createdAt is invalid.`);
    }
    assertSafeHttpsUrl(update.manifestPermalink, `${platform} manifest permalink`);
    byPlatform[platform] = {
      id: String(update.id).toLowerCase(),
      manifestPermalink: String(update.manifestPermalink),
    };
  }
  if (expectedPlatforms.size !== 0 || ids.size !== PLATFORM_NAMES.length || groups.size !== 1) {
    throw new Error(
      "EAS provider output must contain distinct Android and iOS updates in one group.",
    );
  }
  return {
    branch,
    candidateSha,
    groupId: [...groups][0],
    message: updates[0].message,
    platforms: byPlatform,
    runtimeVersion,
  };
}

function validateGeneratedMetadata(raw, expected, publishedIdentity) {
  const metadata = parseNonEmptyJson(raw, "EAS generated update metadata");
  if (!metadata || !Array.isArray(metadata.updates)) {
    throw new Error("EAS generated update metadata must contain an updates array.");
  }
  const metadataIdentity = validatePublishedUpdates(metadata.updates, expected);
  if (
    metadataIdentity.groupId !== publishedIdentity.groupId ||
    PLATFORM_NAMES.some(
      (platform) =>
        metadataIdentity.platforms[platform].id !== publishedIdentity.platforms[platform].id,
    )
  ) {
    throw new Error("EAS metadata update identities do not match the provider response.");
  }
  return metadataIdentity;
}

function parseUpdateList(raw) {
  const parsed = parseNonEmptyJson(raw, "EAS update:list output");
  if (!parsed || !Array.isArray(parsed.currentPage)) {
    throw new Error("EAS update:list output must contain currentPage.");
  }
  return parsed.currentPage;
}

function validateNoDuplicateCandidate(raw, { branch, candidateSha, kind, runtimeVersion }) {
  assertExpectedIdentity({ branch, candidateSha, kind, runtimeVersion });
  const marker = `${kind} ${candidateSha}: `;
  const duplicates = parseUpdateList(raw).filter(
    (group) =>
      group?.branch === branch &&
      group?.runtimeVersion === runtimeVersion &&
      typeof group?.message === "string" &&
      group.message.includes(marker),
  );
  if (duplicates.length !== 0) {
    throw new Error(
      `Candidate ${candidateSha} already has an EAS update on ${branch}/${runtimeVersion}; refusing a duplicate publish.`,
    );
  }
  return { checkedGroups: parseUpdateList(raw).length };
}

function validatePlatformsDescription(value) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized.includes("android") || !normalized.includes("ios")) {
    throw new Error("Observed EAS update group does not contain both Android and iOS.");
  }
}

function validateProviderObservation(
  { channelRaw, listRaw },
  { branch, candidateSha, groupId, kind, rolloutPercentage, runtimeVersion },
) {
  assertExpectedIdentity({ branch, candidateSha, kind, runtimeVersion });
  if (!UUID_PATTERN.test(groupId)) throw new Error("Published EAS group ID is invalid.");
  const groups = parseUpdateList(listRaw);
  const observed = groups.find((group) => String(group?.group || "").toLowerCase() === groupId);
  if (!observed) throw new Error("Published EAS group is absent from update:list observation.");
  if (observed.branch !== branch || observed.runtimeVersion !== runtimeVersion) {
    throw new Error("Observed EAS group branch or runtimeVersion mismatch.");
  }
  if (observed.rolloutPercentage !== rolloutPercentage) {
    throw new Error(`Observed EAS rollout must be exactly ${rolloutPercentage} percent.`);
  }
  if (
    typeof observed.message !== "string" ||
    !observed.message.includes(`${kind} ${candidateSha}: `)
  ) {
    throw new Error("Observed EAS group message is not tied to the candidate SHA.");
  }
  validatePlatformsDescription(observed.platforms);

  const channelResponse = parseNonEmptyJson(channelRaw, "EAS channel:view output");
  const channel = channelResponse?.currentPage;
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) {
    throw new Error("EAS channel:view output must contain a channel object.");
  }
  if (channel.name !== kind || channel.isPaused === true) {
    throw new Error(`EAS ${kind} channel is missing or paused.`);
  }
  if (
    !Array.isArray(channel.updateBranches) ||
    !channel.updateBranches.some((item) => item?.name === branch)
  ) {
    throw new Error(`EAS ${kind} channel is not linked to branch ${branch}.`);
  }
  return {
    branch,
    candidateSha,
    channel: kind,
    groupId,
    rolloutPercentage,
    runtimeVersion,
  };
}

function parseArguments(args) {
  const options = {};
  const [command, ...rest] = args;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    index += 1;
    if (index >= rest.length || rest[index].startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[argument.slice(2)] = rest[index];
  }
  return { command, options };
}

function required(options, name) {
  const value = String(options[name] || "").trim();
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

function readRequired(options, name) {
  return fs.readFileSync(path.resolve(required(options, name)), "utf8");
}

function expectedFromOptions(options) {
  return {
    branch: required(options, "branch"),
    candidateSha: required(options, "candidate").toLowerCase(),
    kind: required(options, "kind"),
    runtimeVersion: required(options, "runtime-version"),
  };
}

function writeSummary(options, summary) {
  const outputPath = path.resolve(required(options, "output"));
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized, "utf8");
  fs.writeFileSync(`${outputPath}.sha256`, `${sha256(serialized)}  ${path.basename(outputPath)}\n`);
}

function runCommand(command, options) {
  const expected = expectedFromOptions(options);
  if (command === "preflight") {
    const result = validateNoDuplicateCandidate(readRequired(options, "update-list"), expected);
    console.log(`[ota-provider] OK: checked ${result.checkedGroups} groups; candidate is new.`);
    return result;
  }

  const expectedMessage = required(options, "message");
  const published = validatePublishedUpdates(readRequired(options, "provider-output"), {
    ...expected,
    expectedMessage,
  });
  validateGeneratedMetadata(
    readRequired(options, "update-metadata"),
    {
      ...expected,
      expectedMessage,
    },
    published,
  );
  if (command === "publish") {
    const summary = {
      schemaVersion: 1,
      kind: "eas-update-publish-validation",
      ...published,
    };
    writeSummary(options, summary);
    console.log(`[ota-provider] OK: validated published group ${published.groupId}.`);
    return summary;
  }
  if (command === "observe") {
    const observed = validateProviderObservation(
      {
        channelRaw: readRequired(options, "channel-view"),
        listRaw: readRequired(options, "update-list"),
      },
      {
        ...expected,
        groupId: published.groupId,
        rolloutPercentage: Number(required(options, "rollout-percentage")),
      },
    );
    const summary = {
      schemaVersion: 1,
      kind: "eas-update-provider-observation",
      generatedAt: new Date().toISOString(),
      provider: published,
      observed,
    };
    writeSummary(options, summary);
    console.log(`[ota-provider] OK: observed ${published.groupId} on ${observed.channel}.`);
    return summary;
  }
  throw new Error("Expected command: preflight, publish, or observe.");
}

function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  runCommand(command, options);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      `[ota-provider] FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  parseNonEmptyJson,
  parseUpdateList,
  runCommand,
  sha256,
  validateGeneratedMetadata,
  validateNoDuplicateCandidate,
  validateProviderObservation,
  validatePublishedUpdates,
};
