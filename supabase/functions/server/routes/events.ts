import type { EdgeRouteApp, ServerRouteDeps } from "../types.ts";
import { registerEventCommentRoutes } from "./events.commentRoutes.ts";
import { registerEventMutationRoutes } from "./events.mutationRoutes.ts";
import { createEventRouteContext } from "./eventsRouteHelpers.ts";

export function registerEventRoutes(app: EdgeRouteApp, deps: ServerRouteDeps) {
  const {
    addNotification,
    adminSupabase,
    enrichEvent,
    generateId,
    getUser,
    loadCanonicalProfile,
    timeAgo,
  } = deps;
  const createEventRequestContext = createEventRouteContext({
    adminSupabase,
    enrichEvent,
  });

  registerEventMutationRoutes(
    app,
    {
      addNotification,
      adminSupabase,
      generateId,
      getUser,
      loadCanonicalProfile,
    },
    createEventRequestContext,
  );

  registerEventCommentRoutes(app, {
    adminSupabase,
    getUser,
    timeAgo,
  });
}
