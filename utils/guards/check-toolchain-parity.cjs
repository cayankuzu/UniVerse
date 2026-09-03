const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, ".github", "workflows");
const TOOLING_DOCKERFILE = path.join(ROOT, "infra", "docker", "Dockerfile.tooling");
const NODE_IMAGE_PATTERN =
  /^ARG NODE_IMAGE=node:(\d+)\.(\d+)\.(\d+)-[a-z0-9-]+@sha256:[0-9a-f]{64}$/m;

function fail(message) {
  console.error(`[toolchain-parity] FAIL: ${message}`);
  process.exit(1);
}

function collectWorkflowNodeVersions() {
  const versions = new Map();
  for (const entry of fs.readdirSync(WORKFLOWS_DIR)) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, entry), "utf8");
    for (const match of content.matchAll(/^\s*node-version:\s*["']?([^"'\s#]+)["']?\s*$/gm)) {
      const declared = match[1];
      if (!/^\d+$/.test(declared)) {
        fail(
          `${entry} declares node-version "${declared}"; pin a single major so CI, Docker, and local runs agree.`,
        );
      }
      if (!versions.has(declared)) versions.set(declared, []);
      versions.get(declared).push(entry);
    }
  }
  return versions;
}

const workflowVersions = collectWorkflowNodeVersions();
if (workflowVersions.size === 0) {
  fail("No workflow declares a node-version; CI must pin its Node major explicitly.");
}
if (workflowVersions.size > 1) {
  const detail = [...workflowVersions.entries()]
    .map(([version, files]) => `${version} (${[...new Set(files)].join(", ")})`)
    .join(" vs ");
  fail(`Workflows disagree on the Node major: ${detail}.`);
}

const [ciNodeMajor] = [...workflowVersions.keys()];

const dockerfile = fs.readFileSync(TOOLING_DOCKERFILE, "utf8");
const imageMatch = NODE_IMAGE_PATTERN.exec(dockerfile);
if (!imageMatch) {
  fail(
    "infra/docker/Dockerfile.tooling must pin NODE_IMAGE to an explicit node:<major>.<minor>.<patch>-<variant>@sha256:<digest>.",
  );
}

const dockerNodeMajor = imageMatch[1];
if (dockerNodeMajor !== ciNodeMajor) {
  fail(
    `Docker quality image runs Node ${dockerNodeMajor} while CI workflows run Node ${ciNodeMajor}. ` +
      "The Docker quality environment must reproduce the CI toolchain.",
  );
}

console.log(
  `[toolchain-parity] OK: CI workflows and the Docker quality image both run Node ${ciNodeMajor} ` +
    `(image node:${imageMatch[1]}.${imageMatch[2]}.${imageMatch[3]}, digest pinned).`,
);
