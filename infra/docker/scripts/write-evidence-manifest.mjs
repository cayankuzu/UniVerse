import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertCiGitClean,
  assertFile,
  gitDirty,
  gitSha,
  repositoryRoot,
  run,
  sha256File,
} from "./common.mjs";

const artifactsDir = resolve(repositoryRoot, "artifacts/docker");
const manifestPath = resolve(artifactsDir, "evidence-manifest.json");
const temporaryManifestPath = `${manifestPath}.tmp`;
const requiredArtifacts = [
  "load-evidence.json",
  "resilience-evidence.json",
  "restore-probe.dump",
  "security-evidence.json",
  "test-evidence.json",
  "tooling-sbom.cdx.json",
  "trivy-report.json",
  "trivy.log",
];
const profileEvidence = [
  ["load-evidence.json", "load"],
  ["resilience-evidence.json", "resilience"],
  ["security-evidence.json", "security"],
  ["test-evidence.json", "test"],
];

assertCiGitClean();
const sha = gitSha();
const treeSha = String(
  run("git", ["rev-parse", "HEAD^{tree}"], { capture: true }).stdout || "",
).trim();
const githubActions = String(process.env.GITHUB_ACTIONS || "").toLowerCase() === "true";

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (githubActions && !value) {
    throw new Error(`GitHub Actions evidence is missing ${name}.`);
  }
  return value || null;
}

const githubSha = requiredEnvironment("GITHUB_SHA");
if (githubActions && githubSha !== sha) {
  throw new Error(`Checked-out SHA ${sha} does not match GITHUB_SHA ${githubSha}.`);
}

for (const artifact of requiredArtifacts) {
  assertFile(resolve(artifactsDir, artifact), `Required Docker evidence is missing: ${artifact}`);
}

for (const [file, profile] of profileEvidence) {
  const parsed = JSON.parse(readFileSync(resolve(artifactsDir, file), "utf8"));
  if (parsed.gitSha !== sha || parsed.profile !== profile) {
    throw new Error(`${file} is not bound to ${profile} at ${sha}.`);
  }
  if (githubActions && parsed.gitDirty !== false) {
    throw new Error(`${file} was produced from a dirty checkout.`);
  }
}

const manifest = {
  artifacts: requiredArtifacts.map((file) => {
    const filePath = resolve(artifactsDir, file);
    return {
      bytes: statSync(filePath).size,
      file,
      sha256: sha256File(filePath),
    };
  }),
  git: {
    dirty: gitDirty(),
    sha,
    treeSha,
  },
  github: {
    actions: githubActions,
    eventName: requiredEnvironment("GITHUB_EVENT_NAME"),
    job: requiredEnvironment("GITHUB_JOB"),
    ref: requiredEnvironment("GITHUB_REF"),
    runAttempt: requiredEnvironment("GITHUB_RUN_ATTEMPT"),
    runId: requiredEnvironment("GITHUB_RUN_ID"),
    sha: githubSha,
    workflow: requiredEnvironment("GITHUB_WORKFLOW"),
  },
  schemaVersion: 1,
};

rmSync(temporaryManifestPath, { force: true });
try {
  writeFileSync(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryManifestPath, manifestPath);
} finally {
  rmSync(temporaryManifestPath, { force: true });
}

process.stdout.write(
  `[docker-evidence] ${requiredArtifacts.length} artifacts bound to ${sha} (${treeSha}).\n`,
);
