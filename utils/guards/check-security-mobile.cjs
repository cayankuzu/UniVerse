const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const AUTH_STORAGE = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "platform",
  "storage",
  "authStorage.ts",
);
const CLEAR_SENSITIVE_STATE = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "data",
  "security",
  "clearSensitiveClientState.ts",
);
const AUTH_SESSION_BOUNDARY = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "data",
  "security",
  "authSessionBoundary.ts",
);
const AUTH_LIFECYCLE = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "app-shell",
  "auth",
  "session",
  "useAuthSessionLifecycle.ts",
);
const AUTH_CALLBACK = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "features",
  "auth",
  "ui",
  "screens",
  "AuthCallbackScreen.tsx",
);
const RESET_PASSWORD = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "features",
  "auth",
  "ui",
  "screens",
  "ResetPasswordScreen.tsx",
);
const DEEP_LINK_BRIDGE = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "app-shell",
  "navigation",
  "bridges",
  "useSupabaseDeepLinkBridge.ts",
);
const AUTH_LIFECYCLE_HELPERS = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "app-shell",
  "auth",
  "session",
  "useAuthSessionLifecycle.helpers.ts",
);
const PUSH_REGISTRATION = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "app-shell",
  "bridges",
  "usePushRegistrationSync.ts",
);
const NOTIFICATION_PERMISSION = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "platform",
  "notifications",
  "notificationPermission.ts",
);
const HOME_ACTIONS = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "features",
  "home",
  "ui",
  "useHomeScreenActions.ts",
);
const QUEUE_PROCESSOR_CORE = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "app-shell",
  "queues",
  "usePersistentQueueProcessor.ts",
);
const DEVICE_PERMISSIONS = path.join(
  ROOT,
  "src",
  "mobile",
  "app",
  "platform",
  "permissions",
  "devicePermissions.ts",
);
const PACKAGE_JSON = path.join(ROOT, "package.json");
const ANDROID_BUILD = path.join(ROOT, "android", "app", "build.gradle");
const ANDROID_MANIFEST = path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
const ROUTE_FILES = [
  path.join(ROOT, "supabase", "functions", "server", "routes", "follows.ts"),
  path.join(ROOT, "supabase", "functions", "server", "routes", "social.ts"),
  path.join(ROOT, "supabase", "functions", "server", "routes", "events.mutationRoutes.ts"),
  path.join(ROOT, "supabase", "functions", "server", "routes", "albums.mutationRoutes.ts"),
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertContains(content, pattern, message) {
  if (!pattern.test(content)) {
    throw new Error(message);
  }
}

const authStorage = read(AUTH_STORAGE);
const clearSensitiveState = read(CLEAR_SENSITIVE_STATE);
const authSessionBoundary = read(AUTH_SESSION_BOUNDARY);
const authLifecycle = read(AUTH_LIFECYCLE);
const authCallback = read(AUTH_CALLBACK);
const resetPassword = read(RESET_PASSWORD);
const deepLinkBridge = read(DEEP_LINK_BRIDGE);
const authLifecycleHelpers = read(AUTH_LIFECYCLE_HELPERS);
const pushRegistration = read(PUSH_REGISTRATION);
const notificationPermission = read(NOTIFICATION_PERMISSION);
const homeActions = read(HOME_ACTIONS);
const queueProcessorCore = read(QUEUE_PROCESSOR_CORE);
const devicePermissions = read(DEVICE_PERMISSIONS);
const packageJson = read(PACKAGE_JSON);
const androidBuild = read(ANDROID_BUILD);
const androidManifest = read(ANDROID_MANIFEST);

assertContains(
  authStorage,
  /expo-secure-store/,
  "[security-mobile] auth storage must remain SecureStore-backed.",
);
assertContains(
  authStorage,
  /SecureStore\.setItemAsync/,
  "[security-mobile] auth storage must write through SecureStore when available.",
);
assertContains(
  clearSensitiveState,
  /QUERY_CACHE_PERSIST_KEY/,
  "[security-mobile] sensitive state purge must include persisted query cache.",
);
assertContains(
  clearSensitiveState,
  /clearPersistedQueryCache/,
  "[security-mobile] sensitive state purge must clear query cache disk persistence.",
);
assertContains(
  authSessionBoundary,
  /clearSensitiveClientState/,
  "[security-mobile] hardSignOut must use centralized sensitive state cleanup.",
);
assertContains(
  authSessionBoundary,
  /await clearSensitiveClientState\(\{ reason \}\)/,
  "[security-mobile] hardSignOut must purge sensitive client state.",
);
assertContains(
  authLifecycle,
  /hardSignOut\("logout"\)/,
  "[security-mobile] logout flow must hard sign out through the centralized purge path.",
);
assertContains(
  authLifecycle,
  /hardSignOut\("delete-account"\)/,
  "[security-mobile] delete-account flow must hard sign out through the centralized purge path.",
);
assertContains(
  resetPassword,
  /hardSignOut\("reset-password-boundary"\)/,
  "[security-mobile] reset-password boundary must purge sensitive state on auth recovery failure.",
);
assertContains(
  authCallback,
  /hardSignOut\("auth-recovery-failed"\)/,
  "[security-mobile] auth callback failure must purge sensitive state.",
);
assertContains(
  deepLinkBridge,
  /CommonActions\.reset/,
  "[security-mobile] deep-link bridge must scrub navigation state.",
);
assertContains(
  authLifecycleHelpers,
  /sha256\(encodeAccessToken\(accessToken\)\)/,
  "[security-mobile] auth hydration keys must use a one-way token fingerprint.",
);
if (/access_token[^\n]*slice\s*\(/i.test(authLifecycleHelpers)) {
  throw new Error("[security-mobile] access-token material must not be sliced into cache keys.");
}
if (/requestPermissionsAsync\s*\(/.test(pushRegistration)) {
  throw new Error("[security-mobile] login/background push sync must not prompt for permission.");
}
assertContains(
  notificationPermission,
  /requestNotificationPermissionFromUserInteraction/,
  "[security-mobile] notification permission must be owned by an explicit interaction helper.",
);
assertContains(
  homeActions,
  /requestNotificationPermissionFromUserInteraction\(\)/,
  "[security-mobile] the existing notifications interaction must own the push prompt timing.",
);
assertContains(
  queueProcessorCore,
  /screenKey:\s*"authenticated-owner"/,
  "[security-mobile] queue telemetry must use a privacy-safe aggregate screen key.",
);
if (/screenKey:\s*ownerId/.test(queueProcessorCore)) {
  throw new Error("[security-mobile] raw owner UUIDs must not be sent as telemetry screen keys.");
}
if (/expo-location/.test(packageJson + devicePermissions)) {
  throw new Error(
    "[security-mobile] unused location permission code/dependency must stay removed.",
  );
}
if (/ACCESS_(?:COARSE|FINE)_LOCATION|hardware[.]location/.test(androidManifest)) {
  throw new Error("[security-mobile] Android must not declare unused location capabilities.");
}
if (/play[.]integrity|PLAY_INTEGRITY/i.test(androidBuild)) {
  throw new Error("[security-mobile] partial Play Integrity configuration must stay removed.");
}
assertContains(
  deepLinkBridge,
  /handleSupabaseDeepLink/,
  "[security-mobile] deep-link bridge must process auth payloads centrally.",
);

for (const routeFile of ROUTE_FILES) {
  const content = read(routeFile);
  assertContains(
    content,
    /enforceCompatMutationRateLimit/,
    `[security-mobile] ${path.basename(routeFile)} must use centralized compat mutation rate limiting.`,
  );
}

console.log("[security-mobile] OK: mobile security guards passed.");
