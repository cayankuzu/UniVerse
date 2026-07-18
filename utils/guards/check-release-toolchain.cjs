const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
function isToolAvailable(tool) {
  if (process.platform === "win32") {
    const whereResult = spawnSync("where.exe", [tool.whereName], {
      encoding: "utf8",
      shell: false,
      stdio: "pipe",
    });
    if (whereResult.status === 0) {
      return true;
    }
  }

  for (const candidate of tool.candidates) {
    const result = spawnSync(candidate, tool.args, {
      encoding: "utf8",
      shell: false,
      stdio: "pipe",
    });
    if (result.error && (result.error.code === "ENOENT" || result.error.code === "EINVAL")) {
      continue;
    }
    return result.status === 0;
  }
  return false;
}

function isSupabaseCliAvailable() {
  const candidates =
    process.platform === "win32"
      ? ["supabase.exe", "supabase.cmd", "supabase.bat", "supabase"]
      : ["supabase"];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      shell: false,
      stdio: "pipe",
    });
    if (result.error && (result.error.code === "ENOENT" || result.error.code === "EINVAL")) {
      continue;
    }
    return result.status === 0;
  }

  const npmCandidates = process.platform === "win32" ? ["npm.cmd", "npm.exe", "npm"] : ["npm"];

  for (const candidate of npmCandidates) {
    const npmExecResult = spawnSync(candidate, ["exec", "--yes", "--", "supabase", "--version"], {
      encoding: "utf8",
      shell: false,
      stdio: "pipe",
    });
    if (
      npmExecResult.error &&
      (npmExecResult.error.code === "ENOENT" || npmExecResult.error.code === "EINVAL")
    ) {
      continue;
    }
    return Boolean(npmExecResult) && npmExecResult.status === 0;
  }

  const npmCliCandidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean);

  for (const npmCliPath of npmCliCandidates) {
    if (!fs.existsSync(npmCliPath)) {
      continue;
    }
    const npmExecResult = spawnSync(
      process.execPath,
      [npmCliPath, "exec", "--yes", "--", "supabase", "--version"],
      {
        encoding: "utf8",
        shell: false,
        stdio: "pipe",
      },
    );
    return Boolean(npmExecResult) && npmExecResult.status === 0;
  }

  return false;
}

const REQUIRED_TOOLS = [
  {
    name: "semgrep",
    whereName: "semgrep",
    candidates:
      process.platform === "win32"
        ? ["semgrep.cmd", "semgrep.exe", "semgrep.bat", "semgrep"]
        : ["semgrep"],
    args: ["--version"],
  },
  {
    name: "gitleaks",
    whereName: "gitleaks",
    candidates:
      process.platform === "win32"
        ? ["gitleaks.exe", "gitleaks.cmd", "gitleaks.bat", "gitleaks"]
        : ["gitleaks"],
    args: ["version"],
  },
  {
    name: "maestro",
    whereName: "maestro",
    candidates:
      process.platform === "win32"
        ? ["maestro.cmd", "maestro.exe", "maestro.bat", "maestro"]
        : ["maestro"],
    args: ["--version"],
  },
  {
    name: "k6",
    whereName: "k6",
    candidates: process.platform === "win32" ? ["k6.exe", "k6.cmd", "k6.bat", "k6"] : ["k6"],
    args: ["version"],
  },
];

const missing = [];

for (const tool of REQUIRED_TOOLS) {
  if (!isToolAvailable(tool)) {
    missing.push(tool.name);
  }
}

if (missing.length > 0) {
  console.error(
    `[release-toolchain] Missing required release tools: ${missing.join(", ")}. ` +
      "Install them locally or run release verification in CI with the full toolchain.",
  );
  process.exit(1);
}

if (
  !isToolAvailable({
    name: "psql",
    whereName: "psql",
    candidates:
      process.platform === "win32" ? ["psql.exe", "psql.cmd", "psql.bat", "psql"] : ["psql"],
    args: ["--version"],
  }) &&
  !isSupabaseCliAvailable()
) {
  console.error(
    "[release-toolchain] Missing SQL validation backend. Install psql or make the Supabase CLI available " +
      "(global install or npm exec) before running release verification.",
  );
  process.exit(1);
}

console.log(
  "[release-toolchain] OK: semgrep, gitleaks, maestro, k6, and a SQL validation backend are available.",
);
