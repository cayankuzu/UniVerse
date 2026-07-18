const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function readRehearsalProfile() {
  const profileFlagIndex = process.argv.indexOf("--profile");
  const profileFromArg = profileFlagIndex >= 0 ? process.argv[profileFlagIndex + 1] : "";
  const rawProfile = String(profileFromArg || process.env.K6_REHEARSAL_PROFILE || "gate")
    .trim()
    .toLowerCase();

  if (rawProfile === "gate" || rawProfile === "full") {
    return rawProfile;
  }

  console.error(
    `[loadtest-suite] Unsupported rehearsal profile "${rawProfile}". Use "gate" or "full".`,
  );
  process.exit(1);
}

const rehearsalProfile = readRehearsalProfile();
const baseCommands = [
  ["npm", ["run", "loadtest:smoke"]],
  ["npm", ["run", "loadtest:sustained"]],
];
const commands =
  rehearsalProfile === "full" ? [...baseCommands, ["npm", ["run", "loadtest:1000"]]] : baseCommands;

function resolveNpmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

const npmCliPath = resolveNpmCliPath();
if (!npmCliPath) {
  console.error("[loadtest-suite] Unable to locate npm-cli.js in the current environment.");
  process.exit(1);
}

console.log(`[loadtest-suite] profile=${rehearsalProfile}`);

for (const [, args] of commands) {
  console.log(`[loadtest-suite] running: npm ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [npmCliPath, ...args], {
    env: {
      ...process.env,
      K6_REHEARSAL_PROFILE: rehearsalProfile,
    },
    shell: false,
    stdio: "inherit",
  });
  if (!result || result.status !== 0) {
    process.exit(result ? result.status || 1 : 1);
  }
}

console.log("[loadtest-suite] completed successfully.");
