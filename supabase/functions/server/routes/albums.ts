import type { EdgeRouteApp, ServerRouteDeps } from "../types.ts";
import { registerAlbumCommentRoutes } from "./albums.commentRoutes.ts";
import { registerAlbumMutationRoutes } from "./albums.mutationRoutes.ts";
import { createAlbumRouteContext } from "./albumsRouteContext.ts";

export function registerAlbumRoutes(app: EdgeRouteApp, deps: ServerRouteDeps) {
  const { adminSupabase, getUser, timeAgo } = deps;
  const createAlbumRequestContext = createAlbumRouteContext({
    adminSupabase,
    generateId: deps.generateId,
  });

  registerAlbumMutationRoutes(
    app,
    {
      adminSupabase,
      generateId: deps.generateId,
      getUser,
      loadCanonicalProfile: deps.loadCanonicalProfile,
    },
    createAlbumRequestContext,
  );

  registerAlbumCommentRoutes(app, {
    adminSupabase,
    getUser,
    timeAgo,
  });
}
