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
