const REQUIRED_ENV = [
  "EXPO_PUBLIC_SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
];

const missing = REQUIRED_ENV.filter((name) => !String(process.env[name] || "").trim());

if (missing.length > 0) {
  console.error(
    `[release-sentry-env] Missing required Sentry release env vars: ${missing.join(", ")}. ` +
      "Set them before running release verification.",
  );
  process.exit(1);
}

console.log("[release-sentry-env] OK: required Sentry release env vars are present.");
