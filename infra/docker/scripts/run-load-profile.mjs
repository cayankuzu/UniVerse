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
  compose(["--profile", "load", "build", "load-runner", "mock-upstream"], {
    env: environment,
  });
  compose(["--profile", "load", "up", "--detach", "--wait", "mock-upstream"], {
    env: environment,
  });
  compose(["--profile", "load", "run", "--rm", "load-runner", "run", "/work/load-tests/smoke.js"], {
    env: environment,
  });
  compose(
    ["--profile", "load", "run", "--rm", "load-runner", "run", "/work/load-tests/sustained.js"],
    { env: environment },
  );

  const artifactsDir = resolve(repositoryRoot, "artifacts/docker");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(
    resolve(artifactsDir, "load-evidence.json"),
    `${JSON.stringify(
      {
        gitSha: sha,
        gitDirty: gitDirty(),
        note: "Synthetic mock verifies k6 scripts and semantic gates; it is not capacity evidence.",
        profile: "load",
        scenarios: ["smoke", "sustained"],
      },
      null,
      2,
    )}\n`,
  );
} finally {
  compose([...allProfiles(), "down", "--remove-orphans"], { env: environment });
}
