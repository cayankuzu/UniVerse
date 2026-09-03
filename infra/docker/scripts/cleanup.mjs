import { rmSync } from "node:fs";
import { relative, resolve } from "node:path";

import { allProfiles, compose, repositoryRoot } from "./common.mjs";

const confirmed = String(process.env.DOCKER_CLEAN_CONFIRM || "").trim() === "YES";
const args = [...allProfiles(), "down", "--remove-orphans"];
if (confirmed) args.push("--volumes");
compose(args);

if (!confirmed) {
  process.stdout.write(
    "[docker-cleanup] containers and networks stopped; volumes/artifacts preserved.\n",
  );
  process.exit(0);
}

const artifactsDir = resolve(repositoryRoot, "artifacts/docker");
const relativeTarget = relative(repositoryRoot, artifactsDir).replaceAll("\\", "/");
if (relativeTarget !== "artifacts/docker") {
  throw new Error(`Refusing to clean unexpected target: ${artifactsDir}`);
}
rmSync(artifactsDir, { force: true, recursive: true });
process.stdout.write(
  "[docker-cleanup] explicitly confirmed test volumes and Docker artifacts removed.\n",
);
