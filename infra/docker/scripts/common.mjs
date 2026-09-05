import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDir, "../../..");
export const composeFile = resolve(repositoryRoot, "infra/docker/compose.yaml");
export const supabaseVersion = "2.116.0";

function displayCommand(command, args) {
  return [command, ...args].join(" ");
}

export function run(command, args = [], options = {}) {
  process.stdout.write(`[docker-validation] ${displayCommand(command, args)}\n`);
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: options.capture ? "utf8" : undefined,
    shell: false,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
    ...options.spawn,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = String(result.stderr || "").trim();
    throw new Error(
      `${displayCommand(command, args)} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ""}`,
    );
  }
  return result;
}

export function compose(args, options = {}) {
  return run(
    "docker",
    ["compose", "--project-directory", repositoryRoot, "-f", composeFile, ...args],
    options,
  );
}

export function npxSupabase(args, options = {}) {
  if (process.platform === "win32") {
    const npxCli = resolve(dirname(process.execPath), "node_modules/npm/bin/npx-cli.js");
    assertFile(npxCli, `npm's npx CLI was not found beside Node: ${npxCli}`);
    return run(
      process.execPath,
      [npxCli, "--yes", `supabase@${supabaseVersion}`, ...args],
      options,
    );
  }
  return run("npx", ["--yes", `supabase@${supabaseVersion}`, ...args], options);
}

export function assertFile(filePath, message) {
  if (!existsSync(filePath)) throw new Error(message || `Required file is missing: ${filePath}`);
}

export function gitSha() {
  return String(run("git", ["rev-parse", "HEAD"], { capture: true }).stdout || "").trim();
}

export function gitDirty() {
  return Boolean(
    String(run("git", ["status", "--porcelain"], { capture: true }).stdout || "").trim(),
  );
}

export function validationImageTag(sha = gitSha()) {
  return `${gitDirty() ? "dirty" : "sha"}-${sha.slice(0, 12)}`;
}

export function assertCiGitClean() {
  const ci = String(process.env.CI || "")
    .trim()
    .toLowerCase();
  if ((ci === "1" || ci === "true") && gitDirty()) {
    throw new Error("Docker validation refuses to produce CI evidence from a dirty Git checkout.");
  }
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function allProfiles() {
  return [
    "--profile",
    "test",
    "--profile",
    "resilience",
    "--profile",
    "load",
    "--profile",
    "security",
  ];
}
