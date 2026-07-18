const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BUILD_GRADLE = path.join(ROOT, "android", "app", "build.gradle");
const MANIFEST = path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
const AUTH_API = path.join(ROOT, "src", "mobile", "app", "data", "auth", "auth.api.ts");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const RELEASE_WORKFLOW = path.join(ROOT, ".github", "workflows", "release-verify.yml");
const SECURITY_WORKFLOW = path.join(ROOT, ".github", "workflows", "security-verify.yml");
const APP_CONFIG = path.join(ROOT, "app.config.js");
const ANDROID_SENTRY_PROPERTIES = path.join(ROOT, "android", "sentry.properties");
const SERVER_INDEX = path.join(ROOT, "supabase", "functions", "server", "index.ts");
const ROUTE_REGISTRY = path.join(ROOT, "supabase", "functions", "server", "routeRegistry.ts");
const SOCIAL_API = path.join(ROOT, "src", "mobile", "app", "data", "social", "social.follow.ts");
const SOCIAL_STATUS_API = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "data",
  "social",
  "social.status.ts",
);
const STORAGE_POLICY = path.join(
  ROOT,
  "supabase",
  "functions",
  "server",
  "routes",
  "storagePolicy.ts",
);

function assertContains(content, pattern, message) {
  if (!pattern.test(content)) {
    throw new Error(message);
  }
}

function assertNotContains(content, pattern, message) {
  if (pattern.test(content)) {
    throw new Error(message);
  }
}

const gradle = fs.readFileSync(BUILD_GRADLE, "utf8");
const manifest = fs.readFileSync(MANIFEST, "utf8");
const authApi = fs.readFileSync(AUTH_API, "utf8");
const packageJson = fs.readFileSync(PACKAGE_JSON, "utf8");
const releaseWorkflow = fs.readFileSync(RELEASE_WORKFLOW, "utf8");
const securityWorkflow = fs.readFileSync(SECURITY_WORKFLOW, "utf8");
const appConfig = fs.readFileSync(APP_CONFIG, "utf8");
const androidSentryProperties = fs.readFileSync(ANDROID_SENTRY_PROPERTIES, "utf8");
const serverIndex = fs.readFileSync(SERVER_INDEX, "utf8");
const routeRegistry = fs.readFileSync(ROUTE_REGISTRY, "utf8");
const socialApi = fs.readFileSync(SOCIAL_API, "utf8");
const socialStatusApi = fs.readFileSync(SOCIAL_STATUS_API, "utf8");
const storagePolicy = fs.readFileSync(STORAGE_POLICY, "utf8");
const buildTypesSection = gradle.includes("buildTypes") ? gradle.split("buildTypes")[1] : "";

assertContains(
  gradle,
  /enableMinifyInReleaseBuilds'\)\s*\?:\s*true/,
  "[release-hardening] release minify default must be true.",
);
assertContains(
  gradle,
  /android\.enableShrinkResourcesInReleaseBuilds'\)\s*\?:\s*'true'/,
  "[release-hardening] release shrinkResources default must be true.",
);
assertContains(
  gradle,
  /apply from:\s*new File\(projectDir,\s*"eas-build\.gradle"\)/,
  "[release-hardening] eas-build.gradle import missing.",
);
assertContains(
  gradle,
  /apply plugin:\s*"io\.sentry\.android\.gradle"/,
  "[release-hardening] Android Sentry Gradle plugin must stay enabled.",
);
assertContains(
  gradle,
  /sentry\.gradle/,
  "[release-hardening] React Native Sentry Gradle integration must stay enabled.",
);
assertContains(
  gradle,
  /uploadNativeSymbols = shouldSentryAutoUpload\(\)/,
  "[release-hardening] Android native symbol upload must stay enabled.",
);
assertContains(
  gradle,
  /autoUploadProguardMapping = shouldSentryAutoUpload\(\)/,
  "[release-hardening] Android proguard mapping upload must stay enabled.",
);
assertContains(
  gradle,
  /throw new GradleException\("Release signing is not configured/,
  "[release-hardening] release signing fail-fast missing.",
);
assertContains(
  gradle,
  /Android Google services config is required for production\/release builds/,
  "[release-hardening] Android release Google services fail-fast missing.",
);
assertContains(
  gradle,
  /src\/release\/google-services\.json/,
  "[release-hardening] Gradle must read the materialized release Google services config.",
);
assertNotContains(
  gradle,
  /System\.getenv\("EXPO_ANDROID_GOOGLE_SERVICES_FILE"\)|System\.getenv\("ANDROID_GOOGLE_SERVICES_FILE"\)/,
  "[release-hardening] Gradle must not read arbitrary Google services file-secret paths.",
);
assertNotContains(
  buildTypesSection,
  /release\s*\{[\s\S]*signingConfig signingConfigs\.debug/,
  "[release-hardening] release build still references debug signing.",
);
assertContains(
  manifest,
  /android:allowBackup="false"/,
  "[release-hardening] Android allowBackup must stay false.",
);
assertNotContains(
  authApi,
  /\/auth\/change-password/,
  "[release-hardening] mobile change-password fallback must remain disabled.",
);
assertContains(
  appConfig,
  /sentryDsn:\s*process\.env\.EXPO_PUBLIC_SENTRY_DSN\s*\|\|\s*""/,
  "[release-hardening] app.config.js must continue exposing the public Sentry DSN.",
);
assertContains(
  appConfig,
  /EXPO_IOS_GOOGLE_SERVICES_FILE/,
  "[release-hardening] app.config.js must resolve iOS Google services from file-secret env.",
);
assertContains(
  appConfig,
  /EXPO_ANDROID_GOOGLE_SERVICES_FILE/,
  "[release-hardening] app.config.js must resolve Android Google services from file-secret env.",
);
assertContains(
  appConfig,
  /sentryProject:\s*process\.env\.SENTRY_PROJECT\s*\|\|\s*""/,
  "[release-hardening] app.config.js must continue exposing the Sentry project.",
);
assertContains(
  appConfig,
  /sentryOrg:\s*process\.env\.SENTRY_ORG\s*\|\|\s*""/,
  "[release-hardening] app.config.js must continue exposing the Sentry org.",
);
assertContains(
  androidSentryProperties,
  /defaults\.org=memode-61/,
  "[release-hardening] android/sentry.properties must keep the release organization.",
);
assertContains(
  androidSentryProperties,
  /defaults\.project=universe-mobile/,
  "[release-hardening] android/sentry.properties must keep the release project.",
);
assertContains(
  serverIndex,
  /registerPrimaryRoutes\(app,\s*routeDeps\)/,
  "[release-hardening] server entrypoint must use the route registry.",
);
assertContains(
  routeRegistry,
  /allowRecoveryRoutes:\s*AUTH_RECOVERY_ENDPOINTS_ENABLED/,
  "[release-hardening] auth recovery mounting must be env-driven.",
);
assertContains(
  routeRegistry,
  /mountPasswordFallback:\s*false/,
  "[release-hardening] password fallback route must stay unmounted.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*guard:release-toolchain[^"]*"/,
  "[release-hardening] release verify must enforce the release toolchain guard.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*guard:release-config-parity[^"]*"/,
  "[release-hardening] release verify must enforce release config parity.",
);
assertContains(
  packageJson,
  /"materialize:native-config":\s*"node \.\/scripts\/materialize-native-config\.cjs"/,
  "[release-hardening] native config materialization command missing.",
);
assertContains(
  packageJson,
  /"eas-build-post-install":\s*"node \.\/scripts\/materialize-native-config\.cjs"/,
  "[release-hardening] EAS post-install native config hook missing.",
);
assertContains(
  packageJson,
  /"guard:native-config-materialize":\s*"node \.\/utils\/guards\/check-materialize-native-config\.cjs"/,
  "[release-hardening] native config materialization guard missing.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*guard:release-readiness-docs[^"]*"/,
  "[release-hardening] release verify must enforce release checklist and smoke-readiness docs coverage.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*guard:k6-env[^"]*"/,
  "[release-hardening] release verify must enforce the K6 env guard.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*guard:release-cutover[^"]*"/,
  "[release-hardening] release verify must enforce cutover confirmations and deployed health checks.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*release:sentry:verify[^"]*"/,
  "[release-hardening] release verify must enforce Sentry release verification.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*release:sql:validate[^"]*"/,
  "[release-hardening] release verify must enforce SQL validation.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*test:coverage[^"]*"/,
  "[release-hardening] release verify must enforce Jest coverage.",
);
assertContains(
  packageJson,
  /"format:check:all":\s*"node \.\/utils\/guards\/check-prettier-all\.cjs"/,
  "[release-hardening] full-tree Prettier guard missing.",
);
assertContains(
  packageJson,
  /"guard:diff-coverage":\s*"node \.\/utils\/guards\/check-diff-coverage\.cjs"/,
  "[release-hardening] diff coverage guard missing.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*lint -- --max-warnings=0[^"]*"/,
  "[release-hardening] release verify must enforce zero lint warnings.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*format:check:all[^"]*"/,
  "[release-hardening] release verify must enforce full-tree formatting.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*guard:diff-coverage[^"]*"/,
  "[release-hardening] release verify must enforce diff coverage.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*security:secrets:history[^"]*"/,
  "[release-hardening] release verify must enforce git-history secret scanning.",
);
assertContains(
  packageJson,
  /"release:sentry:verify":\s*"[^"]*guard:release-sentry-env[^"]*"/,
  "[release-hardening] Sentry verification must guard required Sentry env vars.",
);
assertContains(
  packageJson,
  /"release:sentry:verify":\s*"[^"]*release:sentry:healthcheck[^"]*"/,
  "[release-hardening] Sentry verification must enforce release healthcheck confirmation.",
);
assertContains(
  packageJson,
  /"release:sentry:verify":\s*"[^"]*release:prepare-sentry-artifacts[^"]*"/,
  "[release-hardening] Sentry verification must export sourcemap artifacts before upload.",
);
assertContains(
  packageJson,
  /"release:sentry:verify":\s*"[^"]*release:sentry:upload-updates[^"]*"/,
  "[release-hardening] Sentry verification must upload sourcemaps.",
);
assertContains(
  packageJson,
  /"release:sentry:verify":\s*"[^"]*guard:release-native-symbols[^"]*"/,
  "[release-hardening] Sentry verification must enforce native symbol confirmation.",
);
assertContains(
  packageJson,
  /"release:verify":\s*"[^"]*loadtest:rehearsal:full[^"]*"/,
  "[release-hardening] release verify must run the full load-test rehearsal profile.",
);
assertContains(
  releaseWorkflow,
  /npm run release:verify/,
  "[release-hardening] release workflow must run npm run release:verify.",
);
assertContains(
  securityWorkflow,
  /npm run test:coverage/,
  "[release-hardening] security workflow must run the Jest coverage suite.",
);
assertContains(
  releaseWorkflow,
  /EXPO_PUBLIC_SENTRY_DSN:/,
  "[release-hardening] release workflow must pass the public Sentry DSN.",
);
assertContains(
  releaseWorkflow,
  /SENTRY_AUTH_TOKEN:/,
  "[release-hardening] release workflow must pass the Sentry auth token.",
);
assertContains(
  releaseWorkflow,
  /SENTRY_ORG:/,
  "[release-hardening] release workflow must pass the Sentry organization.",
);
assertContains(
  releaseWorkflow,
  /SENTRY_PROJECT:/,
  "[release-hardening] release workflow must pass the Sentry project.",
);
assertContains(
  releaseWorkflow,
  /K6_SUPABASE_URL:/,
  "[release-hardening] release workflow must pass the K6 base URL.",
);
assertContains(
  releaseWorkflow,
  /K6_SUPABASE_ANON_KEY:/,
  "[release-hardening] release workflow must pass the K6 anon key.",
);
assertContains(
  releaseWorkflow,
  /K6_TEST_EMAIL:/,
  "[release-hardening] release workflow must pass the K6 test email.",
);
assertContains(
  releaseWorkflow,
  /K6_TEST_PASSWORD:/,
  "[release-hardening] release workflow must pass the K6 test password.",
);
assertContains(
  releaseWorkflow,
  /K6_PROFILE_USERNAME:/,
  "[release-hardening] release workflow must pass the K6 profile username for full rehearsal coverage.",
);
assertContains(
  releaseWorkflow,
  /K6_EVENT_ID:/,
  "[release-hardening] release workflow must pass the K6 event target for full rehearsal coverage.",
);
assertContains(
  releaseWorkflow,
  /K6_PHOTO_ID:/,
  "[release-hardening] release workflow must pass the K6 photo target for full rehearsal coverage.",
);
assertContains(
  releaseWorkflow,
  /K6_TARGET_PROFILE_ID:/,
  "[release-hardening] release workflow must support K6 mutation target profile IDs.",
);
assertContains(
  releaseWorkflow,
  /K6_TARGET_CLUB_ID:/,
  "[release-hardening] release workflow must support K6 mutation target club IDs.",
);
assertContains(
  releaseWorkflow,
  /K6_NOTIFICATION_ID:/,
  "[release-hardening] release workflow must support K6 mutation target notification IDs.",
);
assertContains(
  releaseWorkflow,
  /K6_ENABLE_MUTATIONS:/,
  "[release-hardening] release workflow must expose the K6 mutation toggle.",
);
assertContains(
  releaseWorkflow,
  /SUPABASE_DB_URL:/,
  "[release-hardening] release workflow must pass SUPABASE_DB_URL for SQL validation.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_EDGE_HEALTHCHECK_URL:/,
  "[release-hardening] release workflow must pass the deployed edge healthcheck URL.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_DB_ROLLOUT_CONFIRMED:/,
  "[release-hardening] release workflow must enforce DB rollout confirmation.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_ENV_PARITY_CONFIRMED:/,
  "[release-hardening] release workflow must enforce env parity confirmation.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_MANUAL_CHECKLISTS_CONFIRMED:/,
  "[release-hardening] release workflow must enforce manual checklist confirmation.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_RUNBOOK_APPROVED:/,
  "[release-hardening] release workflow must enforce runbook approval.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_DEVICE_SIGNOFF_CONFIRMED:/,
  "[release-hardening] release workflow must enforce cross-device signoff.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_SENTRY_HEALTHCHECK_CONFIRMED:/,
  "[release-hardening] release workflow must enforce Sentry healthcheck confirmation.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_SENTRY_TEST_EVENT_CONFIRMED:/,
  "[release-hardening] release workflow must enforce Sentry test event confirmation.",
);
assertContains(
  releaseWorkflow,
  /RELEASE_NATIVE_SYMBOLS_VERIFIED:/,
  "[release-hardening] release workflow must enforce native symbol confirmation.",
);
assertContains(
  storagePolicy,
  /STORAGE_SIGNED_URL_TTL_SECONDS\s*=\s*60\s*\*\s*10/,
  "[release-hardening] signed URL TTL must stay capped at 10 minutes.",
);
assertNotContains(
  socialApi,
  /get<FollowRequestItem\[]>\("\/follows\/requests"\)/,
  "[release-hardening] follow requests must not use legacy edge reads.",
);
assertNotContains(
  socialApi,
  /post<SuccessResponse>\(`\/follows\/requests\//,
  "[release-hardening] follow request mutations must not use legacy edge endpoints.",
);
assertNotContains(
  socialApi,
  /post<\{ blocked: boolean \}>\(`\/blocks\//,
  "[release-hardening] block mutations must not use legacy edge endpoints.",
);
assertNotContains(
  socialApi,
  /del<\{ blocked: boolean \}>\(`\/blocks\//,
  "[release-hardening] unblock mutations must not use legacy edge endpoints.",
);
assertNotContains(
  socialStatusApi,
  /get<FollowStatusResponse>\(`\/follows\/status\//,
  "[release-hardening] follow status must not use legacy edge reads.",
);

console.log("[release-hardening] OK: release and auth hardening guards passed.");
