const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SEMGREP_RUNNERS =
  process.platform === "win32"
    ? [
        {
          command: "py",
          args: ["-3.13", "-m", "semgrep.console_scripts.pysemgrep"],
        },
        {
          command: "py",
          args: ["-3", "-m", "semgrep.console_scripts.pysemgrep"],
        },
        {
          command: "python",
          args: ["-m", "semgrep.console_scripts.pysemgrep"],
        },
        {
          command: "semgrep.exe",
          args: [],
        },
        {
          command: "semgrep.cmd",
          args: [],
        },
        {
          command: "semgrep.bat",
          args: [],
        },
        {
          command: "semgrep",
          args: [],
        },
      ]
    : [
        {
          command: "semgrep",
          args: [],
        },
      ];
const SEMGREP_EXCLUDES = [
  ".git/**",
  "android/**",
  "artifacts/**",
  "assets/**",
  "coverage/**",
  "node_modules/**",
];
const SEMGREP_TARGETS = [
  "src",
  "supabase",
  "utils",
  "app.config.js",
  "jest.config.js",
  "jest.env.js",
  "jest.setup.ts",
  "metro.config.js",
].filter((target) => fs.existsSync(target));

const SEMGREP_STAGE_PREFIX = "universe-semgrep-";
const COPY_EXCLUDED_NAMES = new Set([
  ".git",
  "android",
  "artifacts",
  "assets",
  "coverage",
  "node_modules",
]);

function copyTrackedFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    fs.copyFileSync(source, destination);
    return;
  } catch (error) {
    if (error?.code !== "EACCES" && error?.code !== "EPERM") throw error;
  }

  const relativePath = path.normalize(source).replaceAll("\\", "/");
  if (path.isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith("../")) {
    throw new Error(`[security:sast] Refusing to stage path outside the repository: ${source}`);
  }
  const gitResult = spawnSync("git", ["show", `:${relativePath}`], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });
  if (gitResult.status !== 0 || !Buffer.isBuffer(gitResult.stdout)) {
    throw new Error(`[security:sast] Cannot stage unreadable file: ${relativePath}`);
  }
  fs.writeFileSync(destination, gitResult.stdout);
  console.warn(`[security:sast] Staged unreadable tracked file from Git index: ${relativePath}`);
}

function copyTargetTree(source, destination) {
  const stat = fs.statSync(source);
  if (!stat.isDirectory()) {
    copyTrackedFile(source, destination);
    return;
  }

  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (COPY_EXCLUDED_NAMES.has(entry.name)) continue;
    if (
      !entry.name ||
      entry.name === "." ||
      entry.name === ".." ||
      entry.name.includes("/") ||
      entry.name.includes("\\") ||
      entry.name.includes("\0")
    ) {
      throw new Error(`[security:sast] Unsafe staging path segment: ${entry.name}`);
    }
    copyTargetTree(`${source}${path.sep}${entry.name}`, `${destination}${path.sep}${entry.name}`);
  }
}

function stageSemgrepTargets() {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), SEMGREP_STAGE_PREFIX));
  for (const target of SEMGREP_TARGETS) {
    const destination = path.join(stageRoot, target);
    copyTargetTree(target, destination);
  }
  const repoSemgrepIgnore = fs.existsSync(".semgrepignore")
    ? fs.readFileSync(".semgrepignore", "utf8")
    : "";
  const stagedIgnoreEntries = [
    repoSemgrepIgnore.trim(),
    ".git/",
    "android/",
    "artifacts/",
    "assets/",
    "coverage/",
    "node_modules/",
  ].filter(Boolean);
  fs.writeFileSync(path.join(stageRoot, ".semgrepignore"), stagedIgnoreEntries.join("\n"));
  return stageRoot;
}

const SEMGREP_ARGS = [
  "scan",
  "--config",
  "auto",
  "--error",
  ...SEMGREP_EXCLUDES.flatMap((pattern) => ["--exclude", pattern]),
  ".",
];

let result = null;
const stageRoot = stageSemgrepTargets();

try {
  for (const runner of SEMGREP_RUNNERS) {
    const nextResult = spawnSync(runner.command, [...runner.args, ...SEMGREP_ARGS], {
      cwd: stageRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
      shell: false,
      stdio: "inherit",
    });
    if (
      nextResult.error &&
      (nextResult.error.code === "ENOENT" || nextResult.error.code === "EINVAL")
    ) {
      continue;
    }
    result = nextResult;
    break;
  }
} finally {
  fs.rmSync(stageRoot, { force: true, recursive: true });
}

if (!result || result.status !== 0) {
  if (!result) {
    console.error(
      "[security:sast] semgrep executable not found. Install Semgrep before running npm run security:sast.",
    );
    process.exit(1);
  }
  process.exit(result.status || 1);
}
