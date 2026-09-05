import { chmodSync, closeSync, mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  allProfiles,
  assertCiGitClean,
  compose,
  gitDirty,
  gitSha,
  repositoryRoot,
  run,
  sha256File,
  validationImageTag,
} from "./common.mjs";

assertCiGitClean();

const sha = gitSha();
const tag = validationImageTag(sha);
const image = `universe-validation-tooling:${tag}`;
const environment = { GIT_SHA: sha, UNIVERSE_DOCKER_TAG: tag };
const artifactsDir = resolve(repositoryRoot, "artifacts/docker");
const imageTar = resolve(artifactsDir, "tooling-image.tar");
const sbomPath = resolve(artifactsDir, "tooling-sbom.cdx.json");
const scanPath = resolve(artifactsDir, "trivy-report.json");
const scanLogPath = resolve(artifactsDir, "trivy.log");

mkdirSync(artifactsDir, { recursive: true });

try {
  compose(["--profile", "security", "run", "--rm", "dockerfile-lint"], {
    env: environment,
  });
  compose(["--profile", "test", "build", "--pull", "test-runner"], { env: environment });

  const sbom = run(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges=true",
      "--user",
      "1000:1000",
      "--entrypoint",
      "/bin/cat",
      image,
      "/usr/share/universe/tooling-sbom.cdx.json",
    ],
    { capture: true },
  );
  writeFileSync(sbomPath, String(sbom.stdout || ""));

  rmSync(imageTar, { force: true });
  const outputFd = openSync(imageTar, "w", 0o600);
  try {
    run("docker", ["image", "save", image], {
      spawn: { stdio: ["ignore", outputFd, "inherit"] },
    });
  } finally {
    closeSync(outputFd);
  }
  chmodSync(imageTar, 0o644);

  const scan = compose(["--profile", "security", "run", "--rm", "--no-TTY", "trivy"], {
    allowFailure: true,
    capture: true,
    env: environment,
  });
  writeFileSync(scanPath, String(scan.stdout || ""));
  writeFileSync(scanLogPath, String(scan.stderr || ""));

  if (!String(scan.stdout || "").trim()) {
    throw new Error(
      "Trivy did not produce a JSON report; see artifacts/docker/trivy.log for the operational error.",
    );
  }

  writeFileSync(
    resolve(artifactsDir, "security-evidence.json"),
    `${JSON.stringify(
      {
        gitSha: sha,
        gitDirty: gitDirty(),
        image,
        imageId: String(
          run("docker", ["image", "inspect", image, "--format", "{{.Id}}"], { capture: true })
            .stdout || "",
        ).trim(),
        profile: "security",
        sbomSha256: sha256File(sbomPath),
        trivyLogSha256: sha256File(scanLogPath),
        trivyReportSha256: sha256File(scanPath),
      },
      null,
      2,
    )}\n`,
  );

  if (scan.status !== 0) {
    throw new Error(
      "Trivy found a fixable HIGH or CRITICAL vulnerability; see artifacts/docker/trivy-report.json.",
    );
  }
} finally {
  rmSync(imageTar, { force: true });
  compose([...allProfiles(), "down", "--remove-orphans"], { env: environment });
}
