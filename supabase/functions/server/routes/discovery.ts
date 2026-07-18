import type { EdgeRouteApp, ServerRouteDeps } from "../types.ts";
import { registerDiscoveryReportRoutes } from "./discovery.reportRoutes.ts";
import { registerDiscoveryStorageRoutes } from "./discovery.storageRoutes.ts";
import { createDiscoveryRouteContext } from "./discoveryRouteContext.ts";

export function registerDiscoveryRoutes(app: EdgeRouteApp, deps: ServerRouteDeps) {
  const { adminSupabase, getUser } = deps;
  const routeContext = createDiscoveryRouteContext(adminSupabase);

  registerDiscoveryReportRoutes(
    app,
    {
      adminSupabase,
      getUser,
    },
    routeContext,
  );

  registerDiscoveryStorageRoutes(
    app,
    {
      adminSupabase,
      getUser,
    },
    routeContext,
  );
}
