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
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function splitLines(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
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

function isFormatFile(file) {
  const dotIndex = file.lastIndexOf(".");
  const extension = dotIndex >= 0 ? file.slice(dotIndex).toLowerCase() : "";
  return FORMAT_EXTENSIONS.has(extension) && existsSync(file);
}

const files = [
  ...new Set([
    ...splitLines(runGit(["ls-files"])),
    ...splitLines(runGit(["ls-files", "--others", "--exclude-standard"])),
  ]),
].filter(isFormatFile);

if (files.length === 0) {
  console.log("[format-check-all] OK: no format-checkable files.");
  process.exit(0);
}

console.log(`[format-check-all] Checking ${files.length} file(s).`);

const prettier = getPrettierCommand();
const chunkSize = 80;

for (let index = 0; index < files.length; index += chunkSize) {
  const chunk = files.slice(index, index + chunkSize);
  const result = spawnSync(prettier.command, [...prettier.args, "--check", ...chunk], {
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`[format-check-all] Failed to run Prettier: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("[format-check-all] OK: all format-checkable files passed.");
