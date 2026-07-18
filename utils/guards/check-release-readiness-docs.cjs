const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const MANUAL_SMOKE = path.join(ROOT, "docs", "manual-smoke-checklist.md");
const REHEARSAL = path.join(ROOT, "docs", "release-rehearsal-checklist.md");
const RUNBOOK = path.join(ROOT, "docs", "production-runbook.md");
const ENV_PARITY = path.join(ROOT, "docs", "env-parity-checklist.md");
const READINESS_STATUS = path.join(ROOT, "docs", "production-10-10-readiness-status.md");
const PINNING_ADR = path.join(ROOT, "docs", "adr", "0001-network-trust-certificate-pinning.md");
const RELEASE_EVIDENCE_README = path.join(ROOT, "release-evidence", "README.md");
const MAESTRO_SCRIPT = path.join(ROOT, "utils", "ops", "run-maestro-critical.ps1");
const MAESTRO_PRIMARY = path.join(ROOT, ".maestro", "smoke-critical.yaml");
const MAESTRO_AUTH = path.join(ROOT, ".maestro", "smoke-auth-shell.yaml");

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required release-readiness file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content)) {
    throw new Error(message);
  }
}

const manualSmoke = readFile(MANUAL_SMOKE);
const rehearsal = readFile(REHEARSAL);
const runbook = readFile(RUNBOOK);
const envParity = readFile(ENV_PARITY);
const readinessStatus = readFile(READINESS_STATUS);
const pinningAdr = readFile(PINNING_ADR);
const releaseEvidenceReadme = readFile(RELEASE_EVIDENCE_README);
const maestroScript = readFile(MAESTRO_SCRIPT);
const maestroPrimary = readFile(MAESTRO_PRIMARY);
const maestroAuth = readFile(MAESTRO_AUTH);

assertContains(
  manualSmoke,
  /session restore/i,
  "[release-readiness-docs] manual smoke checklist must cover session restore.",
);
assertContains(
  manualSmoke,
  /follow \/ unfollow/i,
  "[release-readiness-docs] manual smoke checklist must cover follow / unfollow.",
);
assertContains(
  manualSmoke,
  /follow-request accept \/ reject/i,
  "[release-readiness-docs] manual smoke checklist must cover follow-request accept / reject.",
);
assertContains(
  manualSmoke,
  /comment create/i,
  "[release-readiness-docs] manual smoke checklist must cover comment create.",
);
assertContains(
  manualSmoke,
  /create event/i,
  "[release-readiness-docs] manual smoke checklist must cover event creation.",
);
assertContains(
  manualSmoke,
  /upload/i,
  "[release-readiness-docs] manual smoke checklist must cover uploads.",
);
assertContains(
  manualSmoke,
  /profile update/i,
  "[release-readiness-docs] manual smoke checklist must cover profile updates.",
);
assertContains(
  manualSmoke,
  /background mutation/i,
  "[release-readiness-docs] manual smoke checklist must cover background mutation continuity.",
);
assertContains(
  manualSmoke,
  /temporary network/i,
  "[release-readiness-docs] manual smoke checklist must cover retry after temporary network failure.",
);
assertContains(
  manualSmoke,
  /app relaunch/i,
  "[release-readiness-docs] manual smoke checklist must cover app relaunch or startup.",
);

assertContains(
  rehearsal,
  /maestro:test:critical/i,
  "[release-readiness-docs] release rehearsal checklist must require Maestro critical flow validation.",
);
assertContains(
  rehearsal,
  /load-test raporları hazır/i,
  "[release-readiness-docs] release rehearsal checklist must require load-test reports.",
);
assertContains(
  rehearsal,
  /SQL validation raporları hazır/i,
  "[release-readiness-docs] release rehearsal checklist must require SQL validation reports.",
);
assertContains(
  rehearsal,
  /rollback/i,
  "[release-readiness-docs] release rehearsal checklist must cover rollback rehearsal.",
);
assertContains(
  rehearsal,
  /Sentry/i,
  "[release-readiness-docs] release rehearsal checklist must cover Sentry validation.",
);
assertContains(
  rehearsal,
  /Android telefon smoke/i,
  "[release-readiness-docs] release rehearsal checklist must include Android phone smoke coverage.",
);
assertContains(
  rehearsal,
  /tablet veya landscape kapsam dışıdır/i,
  "[release-readiness-docs] release rehearsal checklist must state tablet/landscape scope truthfully.",
);

assertContains(
  envParity,
  /EXPO_PUBLIC_SENTRY_DSN/i,
  "[release-readiness-docs] env parity checklist must include the public Sentry DSN.",
);
assertContains(
  envParity,
  /SENTRY_AUTH_TOKEN/i,
  "[release-readiness-docs] env parity checklist must include the Sentry auth token.",
);
assertContains(
  envParity,
  /SENTRY_ORG/i,
  "[release-readiness-docs] env parity checklist must include the Sentry organization.",
);
assertContains(
  envParity,
  /SENTRY_PROJECT/i,
  "[release-readiness-docs] env parity checklist must include the Sentry project.",
);
assertContains(
  envParity,
  /SUPABASE_DB_URL/i,
  "[release-readiness-docs] env parity checklist must include the SQL validation database URL.",
);
assertContains(
  envParity,
  /K6_SUPABASE_URL/i,
  "[release-readiness-docs] env parity checklist must include the K6 base URL.",
);
assertContains(
  envParity,
  /K6_PROFILE_USERNAME/i,
  "[release-readiness-docs] env parity checklist must include the full rehearsal profile target.",
);
assertContains(
  envParity,
  /RELEASE_EDGE_HEALTHCHECK_URL/i,
  "[release-readiness-docs] env parity checklist must include the release healthcheck URL.",
);
assertContains(
  envParity,
  /RELEASE_SENTRY_HEALTHCHECK_CONFIRMED/i,
  "[release-readiness-docs] env parity checklist must include Sentry release-health confirmation.",
);
assertContains(
  envParity,
  /RELEASE_NATIVE_SYMBOLS_VERIFIED/i,
  "[release-readiness-docs] env parity checklist must include native symbol verification.",
);

assertContains(
  runbook,
  /rollback/i,
  "[release-readiness-docs] production runbook must include rollback guidance.",
);
assertContains(
  runbook,
  /Sentry/i,
  "[release-readiness-docs] production runbook must include Sentry guidance.",
);
assertContains(
  runbook,
  /mutation/i,
  "[release-readiness-docs] production runbook must include mutation health guidance.",
);
assertContains(
  runbook,
  /upload/i,
  "[release-readiness-docs] production runbook must include upload health guidance.",
);

assertContains(
  readinessStatus,
  /35-Area Matrix/i,
  "[release-readiness-docs] 10/10 readiness status must include the 35-area matrix.",
);
assertContains(
  readinessStatus,
  /Manual-Only Remaining Evidence/i,
  "[release-readiness-docs] 10/10 readiness status must list manual-only remaining evidence.",
);
assertContains(
  readinessStatus,
  /Open Engineering Work/i,
  "[release-readiness-docs] 10/10 readiness status must list open engineering work separately from manual evidence.",
);
assertContains(
  readinessStatus,
  /npm run security:verify:internal/i,
  "[release-readiness-docs] 10/10 readiness status must include internal security verification evidence.",
);
assertContains(
  readinessStatus,
  /npm test/i,
  "[release-readiness-docs] 10/10 readiness status must include full Jest evidence.",
);
assertContains(
  readinessStatus,
  /semgrep/i,
  "[release-readiness-docs] 10/10 readiness status must call out release toolchain requirements.",
);
assertContains(
  readinessStatus,
  /gitleaks/i,
  "[release-readiness-docs] 10/10 readiness status must call out secret-scan toolchain requirements.",
);
assertContains(
  readinessStatus,
  /maestro/i,
  "[release-readiness-docs] 10/10 readiness status must call out E2E toolchain requirements.",
);
assertContains(
  readinessStatus,
  /psql/i,
  "[release-readiness-docs] 10/10 readiness status must call out SQL validation toolchain requirements.",
);

assertContains(
  pinningAdr,
  /Do not add certificate pinning/i,
  "[release-readiness-docs] certificate pinning ADR must record the current decision.",
);
assertContains(
  pinningAdr,
  /No fake JS pin configuration/i,
  "[release-readiness-docs] certificate pinning ADR must forbid fake JS-only pinning.",
);
assertContains(
  pinningAdr,
  /Revisit Triggers/i,
  "[release-readiness-docs] certificate pinning ADR must include revisit triggers.",
);
assertContains(
  pinningAdr,
  /Release Evidence Required/i,
  "[release-readiness-docs] certificate pinning ADR must define release evidence.",
);

assertContains(
  releaseEvidenceReadme,
  /release-evidence\/<version>\/<commit-sha>/i,
  "[release-readiness-docs] release evidence README must define the version/SHA folder structure.",
);
assertContains(
  releaseEvidenceReadme,
  /Forbidden contents/i,
  "[release-readiness-docs] release evidence README must forbid secrets and PII.",
);

assertContains(
  maestroScript,
  /\.maestro\/smoke-critical\.yaml/i,
  "[release-readiness-docs] Maestro runner must reference the primary smoke flow.",
);
assertContains(
  maestroScript,
  /\.maestro\/smoke-auth-shell\.yaml/i,
  "[release-readiness-docs] Maestro runner must reference the auth-shell smoke flow.",
);
assertContains(
  maestroPrimary,
  /launchApp/i,
  "[release-readiness-docs] primary Maestro smoke flow must launch the app.",
);
assertContains(
  maestroPrimary,
  /Ana Sayfa/i,
  "[release-readiness-docs] primary Maestro smoke flow must validate the signed-in shell.",
);
assertContains(
  maestroAuth,
  /launchApp/i,
  "[release-readiness-docs] auth-shell Maestro flow must launch the app.",
);
assertContains(
  maestroAuth,
  /Giris Yap/i,
  "[release-readiness-docs] auth-shell Maestro flow must validate the signed-out shell.",
);

console.log(
  "[release-readiness-docs] OK: release checklists, env parity guidance, runbook, and Maestro smoke assets cover the required release flows.",
);
