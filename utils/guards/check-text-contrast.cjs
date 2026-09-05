#!/usr/bin/env node
/* eslint-disable no-console */

// Light theme is the only theme this product ships. Every token used as a text
// colour therefore has to clear WCAG 2.2 AA (4.5:1) against the three surfaces a
// screen can put behind it. Icon-weight tokens stay in the palette for glyphs,
// which only need 3:1 — this guard is what stops them drifting back into copy.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const MOBILE_ROOT = path.join(ROOT, "src", "mobile", "app");
const TOKENS_FILE = path.join(MOBILE_ROOT, "shared", "theme", "tokens.ts");
const TEXT_CONTRAST_MIN = 4.5;
const GRAPHICS_CONTRAST_MIN = 3;
const BASE_SURFACES = ["surface", "background", "surfaceVariant"];

// Text drawn on a deliberately dark or media-backed layer is checked against
// that layer instead of the light surfaces. The value is the layer token.
const DARK_LAYER_TOKENS = new Map([
  ["surface", "foreground"],
  ["onMedia", "mediaBlack"],
  ["borderLight", "foreground"],
  ["primarySoft", "primaryDark"],
  ["primarySofter", "primary"],
  ["dangerSurface", "foreground"],
  ["successBorder", "foreground"],
  ["blueSubtle", "foreground"],
  ["dark700", "surfaceVariant"],
  ["dark600", "surfaceVariant"],
]);

function readColors() {
  const source = fs.readFileSync(TOKENS_FILE, "utf8");
  const block = source.slice(source.indexOf("colors: {"));
  const colors = {};
  for (const match of block.matchAll(/(\w+):\s*"(#[0-9a-fA-F]{6})"/g)) colors[match[1]] = match[2];
  return colors;
}

function relativeLuminance(hex) {
  const normalized = hex.replace("#", "");
  const channels = [0, 2, 4]
    .map((start) => parseInt(normalized.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function worstContrast(colors, token, surfaces) {
  return surfaces.reduce(
    (worst, surface) => Math.min(worst, contrastRatio(colors[token], colors[surface])),
    Number.POSITIVE_INFINITY,
  );
}

function run() {
  const colors = readColors();
  const violations = [];

  for (const file of collectFiles(MOBILE_ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      // `color:` in a style object is text; `color={...}` on an icon is graphics.
      const textMatch = line.match(/(?<!background)(?<![A-Za-z])color:\s*tokens\.colors\.(\w+)/);
      const iconMatch = line.match(/color=\{tokens\.colors\.(\w+)\}/);
      const token = textMatch?.[1] || iconMatch?.[1];
      if (!token || !colors[token]) return;

      const darkLayer = DARK_LAYER_TOKENS.get(token);
      const surfaces = darkLayer ? [darkLayer] : BASE_SURFACES;
      const required = textMatch ? TEXT_CONTRAST_MIN : GRAPHICS_CONTRAST_MIN;
      const ratio = worstContrast(colors, token, surfaces);
      if (ratio >= required) return;

      violations.push({
        file: path.relative(ROOT, file).split(path.sep).join("/"),
        kind: textMatch ? "text" : "icon",
        line: index + 1,
        ratio: ratio.toFixed(2),
        required,
        token,
      });
    });
  }

  if (violations.length > 0) {
    console.error("[text-contrast] WCAG AA contrast violations:");
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.line} ${violation.kind} tokens.colors.${violation.token} ` +
          `= ${violation.ratio}:1 (needs ${violation.required}:1)`,
      );
    }
    process.exit(1);
  }

  console.log("[text-contrast] OK: every text and icon colour clears its WCAG AA threshold.");
}

run();
