#!/usr/bin/env node

const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const FORMAT_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function hasGitRef(ref) {
  return runGit(["rev-parse", "--verify", "--quiet", ref]).length > 0;
}

function splitLines(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function addChangedFiles(files, args) {
  for (const file of splitLines(runGit(args))) {
    files.add(file);
  }
}

function getChangedFiles() {
  const files = new Set();
  const baseRef = process.env.GITHUB_BASE_REF;

  if (baseRef) {
    const remoteBaseRef = `origin/${baseRef}`;
    if (hasGitRef(remoteBaseRef)) {
      addChangedFiles(files, [
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        `${remoteBaseRef}...HEAD`,
      ]);
    }
  } else if (process.env.GITHUB_ACTIONS === "true" && hasGitRef("HEAD^")) {
    addChangedFiles(files, ["diff", "--name-only", "--diff-filter=ACMR", "HEAD^", "HEAD"]);
  }

  addChangedFiles(files, ["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]);
  addChangedFiles(files, ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "HEAD"]);
  for (const file of splitLines(runGit(["ls-files", "--others", "--exclude-standard"]))) {
    files.add(file);
  }

  return [...files].filter((file) => {
    const dotIndex = file.lastIndexOf(".");
    const extension = dotIndex >= 0 ? file.slice(dotIndex).toLowerCase() : "";
    return FORMAT_EXTENSIONS.has(extension) && existsSync(file);
  });
}

function getPrettierCommand() {
  const localEntrypoint = join("node_modules", "prettier", "bin", "prettier.cjs");
  if (existsSync(localEntrypoint)) {
    return {
      command: process.execPath,
      args: [localEntrypoint],
    };
  }

  return {
    command: process.platform === "win32" ? "prettier.cmd" : "prettier",
    args: [],
  };
}

const files = getChangedFiles();

if (files.length === 0) {
  console.log("[format-check] OK: no changed format-checkable files.");
  process.exit(0);
}

console.log(`[format-check] Checking ${files.length} changed file(s).`);

const prettier = getPrettierCommand();
const result = spawnSync(prettier.command, [...prettier.args, "--check", ...files], {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(`[format-check] Failed to run Prettier: ${result.error.message}`);
}

process.exit(result.status ?? 1);
