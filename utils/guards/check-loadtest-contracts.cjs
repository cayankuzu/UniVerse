const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const COMMON = path.join(ROOT, "load-tests", "common.js");
const SUITES = ["smoke.js", "sustained.js", "mixed-1000.js"];

function fail(message) {
  console.error(`[loadtest-contracts] ${message}`);
  process.exit(1);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const common = read(COMMON);

if (/status\s*<\s*500/.test(common)) {
  fail("RPC checks must not accept HTTP 4xx responses as successful.");
}

const requiredCommonContracts = [
  [/[.]status\s*>=\s*200\s*&&\s*r[.]status\s*<\s*300/, "an exact HTTP 2xx check"],
  [/projection body is valid JSON/, "projection JSON validation"],
  [/response has no RPC error/, "PostgREST/RPC error-envelope validation"],
  [/projection body is an object/, "projection object validation"],
  [/projection envelope is complete/, "delta projection envelope validation"],
  [/cursor envelope is complete/, "cursor projection envelope validation"],
  [/request_kind:\s*"mutation"/, "mutation traffic tagging"],
];

for (const [pattern, description] of requiredCommonContracts) {
  if (!pattern.test(common)) {
    fail(`Missing ${description} in load-tests/common.js.`);
  }
}

for (const suiteName of SUITES) {
  const suite = read(path.join(ROOT, "load-tests", suiteName));
  if (!/checks:\s*\["rate>0[.]99"\]/.test(suite)) {
    fail(`${suiteName} must fail the run when semantic checks fall below 99%.`);
  }
  if (!/http_req_failed:\s*\["rate<0[.]01"\]/.test(suite)) {
    fail(`${suiteName} must keep the HTTP failure-rate gate below 1%.`);
  }
}

const mixed = read(path.join(ROOT, "load-tests", "mixed-1000.js"));
if (!/target:\s*1000/.test(mixed)) {
  fail("The full mixed rehearsal must retain a real 1,000-VU stage.");
}

console.log("[loadtest-contracts] OK: HTTP and projection-semantic gates are enforced.");
