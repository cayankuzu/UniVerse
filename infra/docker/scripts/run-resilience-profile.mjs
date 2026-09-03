import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  allProfiles,
  assertCiGitClean,
  compose,
  gitDirty,
  gitSha,
  repositoryRoot,
  validationImageTag,
} from "./common.mjs";

assertCiGitClean();

const sha = gitSha();
const environment = {
  GIT_SHA: sha,
  UNIVERSE_DOCKER_TAG: validationImageTag(sha),
};

try {
  compose(["--profile", "resilience", "build", "resilience-runner"], {
    env: environment,
  });
  compose(["--profile", "resilience", "up", "--detach", "--wait", "mock-upstream", "toxiproxy"], {
    env: environment,
  });
  compose(["--profile", "resilience", "run", "--rm", "resilience-runner"], {
    env: environment,
  });

  const artifactsDir = resolve(repositoryRoot, "artifacts/docker");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(
    resolve(artifactsDir, "resilience-evidence.json"),
    `${JSON.stringify(
      { gitDirty: gitDirty(), gitSha: sha, profile: "resilience", toxiproxy: "2.12.0" },
      null,
      2,
    )}\n`,
  );
} finally {
  compose([...allProfiles(), "down", "--remove-orphans"], { env: environment });
}
