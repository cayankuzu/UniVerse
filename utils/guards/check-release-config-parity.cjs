const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const EAS_JSON = path.join(ROOT, "eas.json");
const APP_CONFIG = path.join(ROOT, "app.config.js");
const APP_JSON = path.join(ROOT, "app.json");
const RUNTIME_CONFIG = path.join(ROOT, "src", "mobile", "app", "platform", "config", "runtime.ts");
const BUILD_GRADLE = path.join(ROOT, "android", "app", "build.gradle");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const MATERIALIZE_NATIVE_CONFIG = path.join(ROOT, "scripts", "materialize-native-config.cjs");
const GITIGNORE = path.join(ROOT, ".gitignore");

function fail(message) {
  console.error(`[release-config-parity] ${message}`);
  process.exit(1);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function expectMatch(content, pattern, message) {
  if (!pattern.test(content)) {
    fail(message);
  }
}

const eas = JSON.parse(readFile(EAS_JSON));
const appConfig = readFile(APP_CONFIG);
const appJson = JSON.parse(readFile(APP_JSON));
const runtimeConfig = readFile(RUNTIME_CONFIG);
const buildGradle = readFile(BUILD_GRADLE);
const packageJson = readFile(PACKAGE_JSON);
const materializeNativeConfig = readFile(MATERIALIZE_NATIVE_CONFIG);
const gitignore = readFile(GITIGNORE);

const previewProfile = eas?.build?.preview;
const productionProfile = eas?.build?.production;

if (!previewProfile || !productionProfile) {
  fail("Missing preview or production build profile in eas.json.");
}

if (previewProfile.channel !== "preview") {
  fail("Preview EAS profile must target the preview channel.");
}

if (productionProfile.channel !== "production") {
  fail("Production EAS profile must target the production channel.");
}

const previewEnv = previewProfile.env || {};
const productionEnv = productionProfile.env || {};
const productionSubmitIos = eas?.submit?.production?.ios || {};

const requiredPreviewEnv = {
  EXPO_PUBLIC_APP_ENV: "preview",
  EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS: "true",
  EXPO_PUBLIC_RELEASE_CHANNEL: "preview",
};

const requiredProductionEnv = {
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS: "true",
  EXPO_PUBLIC_RELEASE_CHANNEL: "production",
};

for (const [name, expected] of Object.entries(requiredPreviewEnv)) {
  if (previewEnv[name] !== expected) {
    fail(`Preview EAS env ${name} must equal ${expected}.`);
  }
}

for (const [name, expected] of Object.entries(requiredProductionEnv)) {
  if (productionEnv[name] !== expected) {
    fail(`Production EAS env ${name} must equal ${expected}.`);
  }
}

expectMatch(
  appConfig,
  /const APP_ENV = process\.env\.EXPO_PUBLIC_APP_ENV \|\| "development";/,
  "app.config.js must derive APP_ENV from EXPO_PUBLIC_APP_ENV.",
);
expectMatch(
  appConfig,
  /const RELEASE_CHANNEL = process\.env\.EXPO_PUBLIC_RELEASE_CHANNEL \|\| APP_ENV;/,
  "app.config.js must derive RELEASE_CHANNEL from EXPO_PUBLIC_RELEASE_CHANNEL.",
);
expectMatch(
  appConfig,
  /EXPO_IOS_GOOGLE_SERVICES_FILE/,
  "app.config.js must resolve iOS Google services config from an injected file-secret path.",
);
expectMatch(
  appConfig,
  /EXPO_ANDROID_GOOGLE_SERVICES_FILE/,
  "app.config.js must resolve Android Google services config from an injected file-secret path.",
);
expectMatch(
  appConfig,
  /EAS_BUILD_PLATFORM/,
  "app.config.js must make production Google services requirements platform-aware.",
);
expectMatch(
  appConfig,
  /Google services config is required for production/,
  "app.config.js must fail fast when production Google services config is missing.",
);
expectMatch(
  packageJson,
  /"materialize:native-config":\s*"node \.\/scripts\/materialize-native-config\.cjs"/,
  "package.json must expose the native config materialization command.",
);
expectMatch(
  packageJson,
  /"eas-build-post-install":\s*"node \.\/scripts\/materialize-native-config\.cjs"/,
  "package.json must hook native config materialization into EAS post-install.",
);
expectMatch(
  packageJson,
  /"guard:native-config-materialize":\s*"node \.\/utils\/guards\/check-materialize-native-config\.cjs"/,
  "package.json must expose the native config materialization guard.",
);
expectMatch(
  materializeNativeConfig,
  /android[\s\S]*app[\s\S]*src[\s\S]*release[\s\S]*google-services\.json/,
  "Native config materializer must write Android Google services to the release source-set target.",
);
expectMatch(
  materializeNativeConfig,
  /package mismatch/,
  "Native config materializer must validate the Android client package.",
);
expectMatch(
  buildGradle,
  /project\.file\("src\/release\/google-services\.json"\)/,
  "Gradle must check the materialized release Google services file.",
);
if (
  /System\.getenv\("EXPO_ANDROID_GOOGLE_SERVICES_FILE"\)|System\.getenv\("ANDROID_GOOGLE_SERVICES_FILE"\)/.test(
    buildGradle,
  )
) {
  fail("Gradle must not read arbitrary Android Google services file-secret paths directly.");
}
if (!gitignore.includes("android/app/src/release/google-services.json")) {
  fail("Materialized Android Google services output must be gitignored.");
}

if (appJson?.expo?.ios?.googleServicesFile || appJson?.expo?.android?.googleServicesFile) {
  fail(
    "app.json must not hard-code Google services file paths; app.config.js owns injected file-secret paths.",
  );
}

if (
  typeof productionSubmitIos.ascApiKeyPath === "string" &&
  productionSubmitIos.ascApiKeyPath.trim()
) {
  fail(
    "eas.json production submit must not hard-code ascApiKeyPath; inject the App Store Connect API key path at submit time.",
  );
}

const requiredRuntimeFlags = {
  disableLegacyEdgeReads: "EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS",
  useOptimisticCreateEvent: "EXPO_PUBLIC_USE_OPTIMISTIC_CREATE_EVENT",
  useOptimisticProfileUpdate: "EXPO_PUBLIC_USE_OPTIMISTIC_PROFILE_UPDATE",
  useProjectionAlbum: "EXPO_PUBLIC_USE_PROJECTION_ALBUM",
  useProjectionEventDetail: "EXPO_PUBLIC_USE_PROJECTION_EVENT_DETAIL",
  useProjectionSearch: "EXPO_PUBLIC_USE_PROJECTION_SEARCH",
};

for (const [flagName, envName] of Object.entries(requiredRuntimeFlags)) {
  expectMatch(
    runtimeConfig,
    new RegExp(`${flagName}:\\s*readBooleanEnv\\("${envName}",\\s*true\\)`),
    `Runtime flag ${flagName} must default to true for release parity.`,
  );
}

console.log("[release-config-parity] OK: preview/production release config parity is enforced.");
