#!/usr/bin/env node
/* eslint-disable no-console */

// `accessibilityLiveRegion` is an Android-only prop. A screen that relies on it
// alone announces its errors, retries and busy states to TalkBack and says
// nothing at all under VoiceOver. Every file that uses it must therefore also
// use `useLiveRegionAnnouncement`, which covers iOS.
//
// The hook is not required to mirror the region one-for-one — a keystroke-level
// region is deliberately summarised — but the file has to have made that call.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const MOBILE_ROOT = path.join(ROOT, "src", "mobile", "app");
const HOOK_NAME = "useLiveRegionAnnouncement";
const LIVE_REGION_PROP = "accessibilityLiveRegion";
const HOOK_FILE = path.join(MOBILE_ROOT, "shared", "hooks", `${HOOK_NAME}.ts`);

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function run() {
  if (!fs.existsSync(HOOK_FILE)) {
    console.error(`[live-region-parity] FAIL: ${HOOK_NAME} is missing; iOS parity has no owner.`);
    process.exit(1);
  }

  const failures = [];
  let covered = 0;

  for (const file of collectFiles(MOBILE_ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes(LIVE_REGION_PROP)) continue;
    if (source.includes(HOOK_NAME)) {
      covered += 1;
      continue;
    }
    failures.push(path.relative(ROOT, file).split(path.sep).join("/"));
  }

  if (failures.length > 0) {
    console.error(
      `[live-region-parity] FAIL: ${LIVE_REGION_PROP} without ${HOOK_NAME} ` +
        "leaves VoiceOver silent in:",
    );
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }

  console.log(
    `[live-region-parity] OK: ${covered} live-region screens also announce for VoiceOver.`,
  );
}

run();
