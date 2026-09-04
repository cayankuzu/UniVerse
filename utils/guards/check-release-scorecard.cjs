const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = process.cwd();
const SCORECARD_PATH = path.join(ROOT, "quality", "release-scorecard.json");
const READINESS_PATH = path.join(ROOT, "docs", "release-readiness.md");
const REQUIRED_AREA_COUNT = 35;
const EVIDENCE_LEVELS = new Set(["STATIC", "AUTOMATED", "RUNTIME_VERIFIED"]);
const DECISIONS = new Set(["GO", "CONDITIONAL GO", "NO-GO"]);
const CERTIFIED_SCORE = 9.8;

function fail(message) {
  console.error(`[release-scorecard] FAIL: ${message}`);
  process.exit(1);
}

let scorecard;
try {
  scorecard = JSON.parse(fs.readFileSync(SCORECARD_PATH, "utf8"));
} catch (error) {
  fail(`quality/release-scorecard.json is missing or invalid JSON: ${error.message}`);
}

if (scorecard.schemaVersion !== 1) fail("Scorecard must declare schemaVersion 1.");
if (!Array.isArray(scorecard.areas) || scorecard.areas.length !== REQUIRED_AREA_COUNT) {
  fail(`Scorecard must cover exactly ${REQUIRED_AREA_COUNT} areas.`);
}

const declaredCodes = new Set(Object.keys(scorecard.evidenceCodes || {}));
if (declaredCodes.size === 0) fail("Scorecard must declare the evidence codes it references.");

const seenIds = new Set();
for (const area of scorecard.areas) {
  const label = `area ${area?.id ?? "?"} (${area?.name ?? "unnamed"})`;

  if (!Number.isInteger(area.id) || area.id < 1 || area.id > REQUIRED_AREA_COUNT) {
    fail(`${label} has an id outside 1..${REQUIRED_AREA_COUNT}.`);
  }
  if (seenIds.has(area.id)) fail(`${label} duplicates an existing area id.`);
  seenIds.add(area.id);

  if (!String(area.name || "").trim()) fail(`${label} is missing a name.`);
  if (!String(area.repositoryHardening || "").trim()) {
    fail(`${label} must state what repository hardening it relies on.`);
  }
  if (!String(area.remainingRisk || "").trim()) {
    fail(`${label} must state its remaining risk.`);
  }
  if (!EVIDENCE_LEVELS.has(area.evidenceLevel)) {
    fail(
      `${label} has evidenceLevel "${area.evidenceLevel}"; expected one of ${[...EVIDENCE_LEVELS].join(", ")}.`,
    );
  }
  if (!DECISIONS.has(area.decision)) {
    fail(`${label} has decision "${area.decision}"; expected one of ${[...DECISIONS].join(", ")}.`);
  }
  if (!Array.isArray(area.missingEvidence)) {
    fail(`${label} must list missingEvidence, using [] when nothing is outstanding.`);
  }
  for (const code of area.missingEvidence) {
    if (!declaredCodes.has(code)) fail(`${label} references undeclared evidence code "${code}".`);
  }

  const hasOutstandingEvidence = area.missingEvidence.length > 0;

  // The whole point of the gate: a number may not outrun its evidence.
  if (area.score !== null) {
    if (typeof area.score !== "number" || !Number.isFinite(area.score)) {
      fail(`${label} has a non-numeric score; use null until it is certified.`);
    }
    if (area.score < 0 || area.score > 10) fail(`${label} has a score outside 0..10.`);
    if (area.evidenceLevel !== "RUNTIME_VERIFIED") {
      fail(
        `${label} is scored while evidenceLevel is ${area.evidenceLevel}; only RUNTIME_VERIFIED may carry a score.`,
      );
    }
    if (hasOutstandingEvidence) {
      fail(`${label} is scored while ${area.missingEvidence.join(", ")} are still outstanding.`);
    }
    if (area.score >= CERTIFIED_SCORE && area.decision !== "GO") {
      fail(`${label} claims ${area.score} but its decision is ${area.decision}.`);
    }
  }

  if (area.decision === "GO") {
    if (hasOutstandingEvidence) {
      fail(`${label} is GO while ${area.missingEvidence.join(", ")} are still outstanding.`);
    }
    if (area.evidenceLevel !== "RUNTIME_VERIFIED") {
      fail(`${label} is GO without runtime-verified evidence.`);
    }
  }
}

const candidateCommit = String(scorecard.candidate?.commit || "");
if (!/^[0-9a-f]{40}$/.test(candidateCommit)) {
  fail("Scorecard must record the full 40-character candidate commit SHA.");
}

const headCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: ROOT,
  encoding: "utf8",
}).trim();
const isScorecardCommit = execFileSync(
  "git",
  ["log", "-1", "--format=%H", "--", "quality/release-scorecard.json"],
  { cwd: ROOT, encoding: "utf8" },
).trim();

if (candidateCommit !== headCommit && candidateCommit !== isScorecardCommit) {
  fail(
    `Scorecard is bound to ${candidateCommit.slice(0, 12)} but HEAD is ${headCommit.slice(0, 12)} ` +
      "and that is not the commit that last touched the scorecard. Regenerate it for this candidate.",
  );
}

const readiness = fs.readFileSync(READINESS_PATH, "utf8");
for (const area of scorecard.areas) {
  if (!readiness.includes(area.name)) {
    fail(
      `docs/release-readiness.md does not mention area "${area.name}"; the two must stay in step.`,
    );
  }
}

const scored = scorecard.areas.filter((area) => area.score !== null);
const certified = scored.filter((area) => area.score >= CERTIFIED_SCORE);
console.log(
  `[release-scorecard] OK: ${scorecard.areas.length} areas, ${scored.length} scored, ` +
    `${certified.length} certified at ${CERTIFIED_SCORE}+, bound to ${candidateCommit.slice(0, 12)}.`,
);
