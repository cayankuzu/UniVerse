function isAffirmative(value) {
  return /^(1|true|yes)$/i.test(String(value || "").trim());
}

const expectedEvent =
  String(process.env.RELEASE_SENTRY_HEALTHCHECK_EVENT || "").trim() ||
  "release-health:preview:app-launch";

if (!expectedEvent) {
  console.error(
    "[release-sentry-healthcheck] Expected Sentry release health event label is missing. " +
      "Set RELEASE_SENTRY_HEALTHCHECK_EVENT before running release verification.",
  );
  process.exit(1);
}

if (!isAffirmative(process.env.RELEASE_SENTRY_HEALTHCHECK_CONFIRMED)) {
  console.error(
    `[release-sentry-healthcheck] Preview/build healthcheck is not confirmed. ` +
      `Verify "${expectedEvent}" in Sentry, then set RELEASE_SENTRY_HEALTHCHECK_CONFIRMED=true.`,
  );
  process.exit(1);
}

console.log(
  `[release-sentry-healthcheck] OK: confirmed Sentry release health event "${expectedEvent}".`,
);
