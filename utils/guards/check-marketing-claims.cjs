#!/usr/bin/env node
/* eslint-disable no-console */

// The claims register is only worth having if something enforces it. A store
// sentence, an ad hook or a deck slide may cite a claim, and this checks that
// the claim exists, that it is approved, and that the register itself has not
// grown a row that asserts something with no evidence behind it.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const MARKETING_DIR = path.join(ROOT, "docs", "marketing");
const REGISTER = path.join(MARKETING_DIR, "claims-register.md");
const CLAIM_ID = /\b([FPMT]-\d{2})\b/g;
const APPROVED = "ONAYLI";
const DRAFT = "TASLAK";
const FORBIDDEN = "YASAK";

// Turkish markers that turn a citation into a prohibition or a deferral rather
// than an assertion. Kept short and explicit on purpose: a sentence that claims
// "M-01 shows thousands of users" carries none of these and still fails.
const RULING_IT_OUT =
  /yasak|kullanılmaz|kullanılamaz|yayınlanmaz|geçmiyor|sayılmaz|iddiası yok|değil|TASLAK|yeniden değerlendir|gelene kadar/iu;

function readRegister() {
  const source = fs.readFileSync(REGISTER, "utf8");
  const rows = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\|\s*([FPMT]-\d{2})\s*\|(.*)$/);
    if (!match) continue;
    const cells = match[2].split("|").map((cell) => cell.trim());
    const status = cells.find((cell) =>
      [APPROVED, DRAFT, FORBIDDEN, `**${FORBIDDEN}**`].includes(cell),
    );
    rows.set(match[1], { cells, status: status?.replace(/\*/g, "") });
  }
  return rows;
}

function marketingDocs() {
  return fs
    .readdirSync(MARKETING_DIR)
    .filter((name) => name.endsWith(".md") && name !== "claims-register.md")
    .map((name) => ({ name, source: fs.readFileSync(path.join(MARKETING_DIR, name), "utf8") }));
}

function run() {
  const rows = readRegister();
  const failures = [];

  if (rows.size === 0)
    failures.push("claims-register.md has no claim rows; the guard would pass vacuously.");

  for (const [id, row] of rows) {
    if (!row.status) {
      failures.push(`${id} has no ${APPROVED}/${DRAFT}/${FORBIDDEN} status.`);
      continue;
    }
    // An approved claim has to name what backs it. The evidence cell is the one
    // that points at a file, a table, an RPC or a run.
    if (
      row.status === APPROVED &&
      !row.cells.some((cell) => /[`(]/.test(cell) && cell.length > 8)
    ) {
      failures.push(`${id} is ${APPROVED} but names no evidence.`);
    }
  }

  for (const { name, source } of marketingDocs()) {
    source.split(/\r?\n/).forEach((line, index) => {
      for (const match of line.matchAll(CLAIM_ID)) {
        const id = match[1];
        const where = `${name}:${index + 1}`;
        const row = rows.get(id);
        if (!row) {
          failures.push(`${where} cites ${id}, which is not in the register.`);
          continue;
        }
        // A line may name a draft or forbidden claim, but only to rule it out or
        // to defer it. Asserting one is the failure this guard exists to catch,
        // so the line has to carry a marker that says which of the two it is.
        if (row.status !== APPROVED && !RULING_IT_OUT.test(line)) {
          failures.push(
            `${where} asserts ${id}, which is ${row.status}. ` +
              `Cite it only to rule it out or defer it, or promote the claim first.`,
          );
        }
      }
    });
  }

  if (failures.length > 0) {
    console.error("[marketing-claims] FAIL:");
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }

  const approved = [...rows.values()].filter((row) => row.status === APPROVED).length;
  const draft = [...rows.values()].filter((row) => row.status === DRAFT).length;
  const forbidden = [...rows.values()].filter((row) => row.status === FORBIDDEN).length;
  console.log(
    `[marketing-claims] OK: ${rows.size} claims (${approved} ${APPROVED}, ${draft} ${DRAFT}, ` +
      `${forbidden} ${FORBIDDEN}); every citation resolves and no copy leans on an unproven one.`,
  );
}

run();
