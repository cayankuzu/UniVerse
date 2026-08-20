const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const EXCEPTIONS_PATH = path.join(ROOT, "security", "dependency-audit-exceptions.json");
const REQUIRED_EXCEPTION_FIELDS = [
  "advisory",
  "package",
  "classification",
  "reason",
  "owner",
  "expires",
];

function fail(message) {
  console.error(`[dependency-audit] FAIL: ${message}`);
  process.exit(1);
}

function readExceptions() {
  const document = JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, "utf8"));
  if (document.schemaVersion !== 1 || !Array.isArray(document.exceptions)) {
    fail("Exception document must use schemaVersion 1 and contain an exceptions array.");
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const entries = new Map();
  for (const entry of document.exceptions) {
    for (const field of REQUIRED_EXCEPTION_FIELDS) {
      if (!String(entry?.[field] ?? "").trim()) {
        fail(`Exception ${entry?.advisory || "unknown"} is missing ${field}.`);
      }
    }
    if (entry.runtimeReachable !== false) {
      fail(`Exception ${entry.advisory} must explicitly set runtimeReachable=false.`);
    }
    const expiresAt = new Date(`${entry.expires}T00:00:00.000Z`);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt < today) {
      fail(`Exception ${entry.advisory} expired on ${entry.expires}.`);
    }
    if (entries.has(entry.advisory)) {
      fail(`Duplicate exception for ${entry.advisory}.`);
    }
    entries.set(entry.advisory, entry);
  }
  return entries;
}

function runAudit() {
  const npmCli = String(process.env.npm_execpath || "").trim();
  if (!npmCli)
    fail("npm_execpath is required; run this guard through npm run guard:dependency-audit.");
  const result = spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const output = String(result.stdout || result.stderr || "").trim();
  if (!output) fail("npm audit produced no JSON output.");
  try {
    return JSON.parse(output);
  } catch (error) {
    fail(`npm audit output was not valid JSON: ${error.message}`);
  }
}

function advisoryId(via) {
  const url = String(via?.url || "");
  const match = url.match(/\/advisories\/(GHSA-[a-z0-9-]+)/i);
  return match?.[1] || String(via?.source || "");
}

function collectRootAdvisories(name, vulnerabilities, visiting = new Set()) {
  if (visiting.has(name)) return [];
  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return [];
  const nextVisiting = new Set(visiting).add(name);
  const roots = [];
  for (const via of vulnerability.via || []) {
    if (typeof via === "string") {
      roots.push(...collectRootAdvisories(via, vulnerabilities, nextVisiting));
    } else {
      roots.push({ advisory: advisoryId(via), package: String(via.name || name) });
    }
  }
  return roots;
}

const exceptions = readExceptions();
const report = runAudit();
const vulnerabilities = report.vulnerabilities || {};
const usedExceptions = new Set();
const unapproved = [];

for (const name of Object.keys(vulnerabilities)) {
  const roots = collectRootAdvisories(name, vulnerabilities);
  if (roots.length === 0) {
    unapproved.push(`${name}: no root advisory could be resolved`);
    continue;
  }
  for (const root of roots) {
    const exception = exceptions.get(root.advisory);
    if (!exception || exception.package !== root.package) {
      unapproved.push(`${name}: ${root.advisory} via ${root.package}`);
      continue;
    }
    usedExceptions.add(root.advisory);
  }
}

const staleExceptions = [...exceptions.keys()].filter((advisory) => !usedExceptions.has(advisory));
if (staleExceptions.length > 0) {
  fail(`Remove stale exceptions that are no longer reported: ${staleExceptions.join(", ")}.`);
}
if (unapproved.length > 0) {
  fail(`Unapproved production dependency findings:\n- ${unapproved.join("\n- ")}`);
}

const total = Number(report.metadata?.vulnerabilities?.total || 0);
if (total === 0) {
  console.log("[dependency-audit] OK: npm reported no production dependency vulnerabilities.");
} else {
  console.log(
    `[dependency-audit] OK WITH EXPIRING BUILD-ONLY EXCEPTIONS: ${total} derived findings, ` +
      `${usedExceptions.size} approved root advisories.`,
  );
  for (const advisory of usedExceptions) {
    const entry = exceptions.get(advisory);
    console.log(
      `[dependency-audit] ${advisory} ${entry.package} owner=${entry.owner} expires=${entry.expires}`,
    );
  }
}
