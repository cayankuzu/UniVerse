function isAffirmative(value) {
  return /^(1|true|yes)$/i.test(String(value || "").trim());
}

function fail(message) {
  console.error(`[release-cutover] ${message}`);
  process.exit(1);
}

async function main() {
  const requiredConfirmations = [
    {
      env: "RELEASE_DB_ROLLOUT_CONFIRMED",
      detail: "Confirm DB migrations/rollout are completed for the target release.",
    },
    {
      env: "RELEASE_ENV_PARITY_CONFIRMED",
      detail: "Confirm docs/env-parity-checklist.md is complete for staging and production.",
    },
    {
      env: "RELEASE_MANUAL_CHECKLISTS_CONFIRMED",
      detail:
        "Confirm docs/manual-smoke-checklist.md and docs/release-rehearsal-checklist.md are fully closed.",
    },
    {
      env: "RELEASE_MEDIA_SCANNER_CONFIRMED",
      detail: "Confirm the media scanner webhook and fail-closed rejection tests are operational.",
    },
    {
      env: "RELEASE_RUNBOOK_APPROVED",
      detail:
        "Confirm docs/production-runbook.md thresholds, rollback plan, and release ownership are approved.",
    },
    {
      env: "RELEASE_DEVICE_SIGNOFF_CONFIRMED",
      detail: "Confirm Android phone and Android tablet same-commit smoke signoff are recorded.",
    },
    {
      env: "RELEASE_SENTRY_TEST_EVENT_CONFIRMED",
      detail:
        "Confirm the preview build emitted a Sentry test crash/event in addition to the release-health event.",
    },
  ];

  const missingConfirmations = requiredConfirmations.filter(
    ({ env }) => !isAffirmative(process.env[env]),
  );

  if (missingConfirmations.length > 0) {
    const details = missingConfirmations.map(({ env, detail }) => `${env}: ${detail}`).join("\n");
    fail(
      `Missing required release cutover confirmations.\n${details}\n` +
        "Set the listed RELEASE_* variables to true before running release verification.",
    );
  }

  const healthUrl = String(process.env.RELEASE_EDGE_HEALTHCHECK_URL || "").trim();
  if (!healthUrl) {
    fail(
      "Missing RELEASE_EDGE_HEALTHCHECK_URL. Point it at the deployed /make-server-e3557d40/health endpoint for the target release.",
    );
  }

  let response;
  try {
    response = await fetch(healthUrl, {
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    fail(
      `Health endpoint request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    fail(`Health endpoint returned HTTP ${response.status} for ${healthUrl}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    fail(
      `Health endpoint did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (payload?.status !== "ok") {
    fail(`Health endpoint status must be "ok". Received: ${JSON.stringify(payload)}`);
  }

  if (payload?.legacyEdgeReadsEnabled !== false) {
    fail("Health endpoint must report legacyEdgeReadsEnabled=false for release verification.");
  }

  if (payload?.compatRoutesEnabled !== false) {
    fail("Health endpoint must report compatRoutesEnabled=false for release verification.");
  }

  if (payload?.authRecoveryEndpointsEnabled !== false) {
    fail(
      "Health endpoint must report authRecoveryEndpointsEnabled=false for release verification.",
    );
  }

  if (payload?.mediaScannerConfigured !== true) {
    fail("Health endpoint must report mediaScannerConfigured=true for release verification.");
  }

  console.log("[release-cutover] OK: deployment health and cutover confirmations are satisfied.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
