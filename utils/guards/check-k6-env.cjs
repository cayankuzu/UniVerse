const BASE_REQUIRED_ENV = ["K6_SUPABASE_URL", "K6_SUPABASE_ANON_KEY"];

const FULL_PROFILE_REQUIRED_ENV = ["K6_PROFILE_USERNAME", "K6_EVENT_ID", "K6_PHOTO_ID"];

const MUTATION_REQUIRED_ENV = ["K6_TARGET_PROFILE_ID", "K6_TARGET_CLUB_ID", "K6_NOTIFICATION_ID"];

function normalize(value) {
  return String(value || "").trim();
}

function isAffirmative(value) {
  return /^true$/i.test(normalize(value));
}

const authMode = normalize(process.env.K6_AUTH_MODE).toLowerCase();
const hasAccessToken = Boolean(normalize(process.env.K6_ACCESS_TOKEN));
const usesAnonAuth = authMode === "anon";
const requiresPasswordAuth = !usesAnonAuth && !hasAccessToken;
const profile =
  normalize(process.env.K6_REHEARSAL_PROFILE || "gate").toLowerCase() === "full" ? "full" : "gate";
const missing = BASE_REQUIRED_ENV.filter((name) => !normalize(process.env[name]));
const missingPasswordAuth = requiresPasswordAuth
  ? ["K6_TEST_EMAIL", "K6_TEST_PASSWORD"].filter((name) => !normalize(process.env[name]))
  : [];
const missingFullProfile =
  profile === "full"
    ? FULL_PROFILE_REQUIRED_ENV.filter((name) => !normalize(process.env[name]))
    : [];
const missingMutationTargets = isAffirmative(process.env.K6_ENABLE_MUTATIONS)
  ? MUTATION_REQUIRED_ENV.filter((name) => !normalize(process.env[name]))
  : [];

if (missing.length > 0) {
  console.error(
    `[k6-env] Missing required load test env vars: ${missing.join(", ")}. ` +
      "Set the base K6_* environment before running load tests.",
  );
  process.exit(1);
}

if (missingPasswordAuth.length > 0) {
  console.error(
    `[k6-env] Missing required password-auth load test env vars: ${missingPasswordAuth.join(", ")}. ` +
      "Set K6_TEST_EMAIL/K6_TEST_PASSWORD, or use K6_AUTH_MODE=anon / K6_ACCESS_TOKEN for read-only rehearsals.",
  );
  process.exit(1);
}

if (missingFullProfile.length > 0) {
  console.error(
    `[k6-env] Missing required full-rehearsal projection target env vars: ${missingFullProfile.join(", ")}. ` +
      "Set these K6_* values before running the full release rehearsal so profile, event, album, and comment projection paths are actually exercised.",
  );
  process.exit(1);
}

if (usesAnonAuth && isAffirmative(process.env.K6_ENABLE_MUTATIONS)) {
  console.error("[k6-env] K6_ENABLE_MUTATIONS=true cannot be used with K6_AUTH_MODE=anon.");
  process.exit(1);
}

if (missingMutationTargets.length > 0) {
  console.error(
    `[k6-env] Missing required mutation target env vars for K6_ENABLE_MUTATIONS=true: ${missingMutationTargets.join(", ")}. ` +
      "Set the mutation target IDs or disable K6_ENABLE_MUTATIONS for this rehearsal.",
  );
  process.exit(1);
}

if (!/^https?:\/\//i.test(normalize(process.env.K6_SUPABASE_URL))) {
  console.error("[k6-env] K6_SUPABASE_URL must be a valid http/https URL.");
  process.exit(1);
}

console.log(
  `[k6-env] OK: required K6 env vars are present for the ${profile} rehearsal profile (auth=${usesAnonAuth ? "anon" : hasAccessToken ? "token" : "password"}).`,
);
