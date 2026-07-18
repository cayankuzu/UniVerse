import {
  AUTH_RECOVERY_ENDPOINTS_ENABLED,
  COMPAT_ROUTES_ENABLED,
  TEST_AUTH_VERIFICATION_BYPASS_ENABLED,
} from "./runtime.ts";
import { registerFollowRoutes } from "./routes/follows.ts";
import { registerSocialRoutes } from "./routes/social.ts";
import { registerAlbumRoutes } from "./routes/albums.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerDiscoveryRoutes } from "./routes/discovery.ts";
import { registerEventRoutes } from "./routes/events.ts";
import { registerPushRoutes } from "./routes/push.ts";
import type { EdgeRouteApp, ServerRouteDeps } from "./types.ts";

export function registerPrimaryRoutes(app: EdgeRouteApp, deps: ServerRouteDeps) {
  registerAuthRoutes(app, deps, {
    allowRecoveryRoutes: AUTH_RECOVERY_ENDPOINTS_ENABLED,
    allowTestVerificationBypassRoutes: TEST_AUTH_VERIFICATION_BYPASS_ENABLED,
    mountPasswordFallback: false,
  });
  registerPushRoutes(app, deps);
  registerEventRoutes(app, deps);
  registerAlbumRoutes(app, deps);
  registerDiscoveryRoutes(app, deps);
}

export function registerRollbackCompatRoutes(app: EdgeRouteApp, deps: ServerRouteDeps) {
  if (!COMPAT_ROUTES_ENABLED) return false;
  registerFollowRoutes(app, deps);
  registerSocialRoutes(app, deps);
  return true;
}
