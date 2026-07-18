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

function stageSemgrepTargets() {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), SEMGREP_STAGE_PREFIX));
  for (const target of SEMGREP_TARGETS) {
    const destination = path.join(stageRoot, target);
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      fs.cpSync(target, destination, {
        recursive: true,
        filter: (source) => {
          const name = path.basename(source);
          return (
            name !== ".git" &&
            name !== "android" &&
            name !== "artifacts" &&
            name !== "assets" &&
            name !== "coverage" &&
            name !== "node_modules"
          );
        },
      });
      continue;
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(target, destination);
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
