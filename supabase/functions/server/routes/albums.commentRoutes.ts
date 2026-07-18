import { logError } from "../logging.ts";
import {
  recordSecurityAuditEvent,
  trackSecurityDetectionSignal,
} from "../services/securityAudit.ts";
import type { ServerRouteDeps } from "../types.ts";
import { createViewerSupabaseClient } from "../services/viewerSupabase.ts";
import { enforceCompatMutationRateLimit } from "./compatMutationRateLimit.ts";
import { loadSqlBlockedActorSet } from "../services/sqlBlockedState.ts";
import {
  parseCommentBody,
  parsePhotoCommentParams,
  parsePhotoParams,
} from "./compatRouteValidation.ts";
import type { AlbumRouteApp } from "./albumsRouteContext.ts";
import { toRouteError } from "./albumsRouteContext.ts";

const ALBUM_COMMENT_WINDOW_MS = 60_000;
const ALBUM_COMMENT_USER_LIMIT = 20;
const ALBUM_COMMENT_IP_LIMIT = 40;

type AlbumCommentRow = {
  body: string;
  created_at: string;
  id: string;
  parent_id: string | null;
  user_id: string;
};

type ProfileRow = {
  club_name?: string | null;
  name?: string | null;
  profile_image_path?: string | null;
  university?: string | null;
  user_id: string;
  username?: string | null;
};

function toCommentResponse(
  row: AlbumCommentRow,
  profile: ProfileRow | null,
  timeAgo: (isoDate: string) => string,
) {
  return {
    createdAt: row.created_at,
    id: row.id,
    image: profile?.profile_image_path || "",
    likedByViewer: false,
    likesCount: 0,
    name: profile?.name || profile?.club_name || profile?.username || "Kullanici",
    parentId: row.parent_id,
    text: row.body,
    time: timeAgo(row.created_at),
    university: profile?.university || "",
    userId: row.user_id,
    username: profile?.username || "kullanici",
  };
}

export function registerAlbumCommentRoutes(
  app: AlbumRouteApp,
  deps: Pick<ServerRouteDeps, "adminSupabase" | "getUser" | "timeAgo">,
) {
  const { adminSupabase, getUser, timeAgo } = deps;

  app.get("/make-server-e3557d40/albums/:photoId/comments", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const { photoId } = parsePhotoParams({
        photoId: c.req.param("photoId"),
      });
      const viewerSupabase = createViewerSupabaseClient(c);
      if (!viewerSupabase) return c.json({ error: "Unauthorized" }, 401);
      const blockedActorIds = await loadSqlBlockedActorSet(adminSupabase, user.id);

      const { data: photoRow, error: photoError } = await adminSupabase
        .from("album_photos")
        .select("id,user_id,event_id")
        .eq("id", photoId)
        .maybeSingle();
      if (photoError) {
        throw new Error(photoError.message);
      }
      if (!photoRow?.id) {
        return c.json({ error: "Album bulunamadi." }, 404);
      }

      const eventId = String(photoRow.event_id || "").trim();
      const { data: eventRow, error: eventError } = eventId
        ? await adminSupabase.from("events").select("id,club_id").eq("id", eventId).maybeSingle()
        : { data: null, error: null };
      if (eventError) {
        throw new Error(eventError.message);
      }

      if (
        blockedActorIds.has(String(photoRow.user_id || "").trim()) ||
        blockedActorIds.has(String(eventRow?.club_id || "").trim())
      ) {
        return c.json({ error: "Bu album yorumlarina erisemiyorsunuz." }, 403);
      }

      const { data: rows, error } = await viewerSupabase
        .from("album_photo_comments")
        .select("id,user_id,parent_id,body,created_at")
        .eq("photo_id", photoId)
        .order("created_at", { ascending: true });
      if (error) {
        throw new Error(error.message);
      }

      const rowMap = new Map(
        ((Array.isArray(rows) ? rows : []) as AlbumCommentRow[]).map((row) => [row.id, row]),
      );
      const commentRows = ((Array.isArray(rows) ? rows : []) as AlbumCommentRow[]).filter((row) => {
        const commentUserId = String(row.user_id || "").trim();
        if (blockedActorIds.has(commentUserId)) return false;
        const parentComment = row.parent_id ? rowMap.get(String(row.parent_id || "")) : null;
        return !blockedActorIds.has(String(parentComment?.user_id || "").trim());
      });
      const userIds = Array.from(
        new Set(commentRows.map((row) => String(row.user_id || "").trim()).filter(Boolean)),
      );
      const { data: profiles, error: profileError } = userIds.length
        ? await viewerSupabase
            .from("profiles")
            .select("user_id,username,name,club_name,profile_image_path,university")
            .in("user_id", userIds)
        : { data: [], error: null };
      if (profileError) {
        throw new Error(profileError.message);
      }

      const profileMap = new Map(
        ((profiles || []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
      );
      await recordSecurityAuditEvent({
        action: "album.comments.read",
        adminSupabase,
        c,
        metadata: { commentCount: commentRows.length },
        resourceId: photoId,
        resourceType: "album",
        result: "success",
        userId: user.id,
      });
      await trackSecurityDetectionSignal({
        action: "album.comments.read",
        adminSupabase,
        c,
        metadata: { commentCount: commentRows.length },
        resourceId: photoId,
        resourceType: "album",
        result: "success",
        severity: "medium",
        signalType: "repeated_access",
        threshold: 24,
        userId: user.id,
        windowMs: 5 * 60_000,
      });
      return c.json(
        commentRows.map((row) =>
          toCommentResponse(row, profileMap.get(row.user_id) ?? null, timeAgo),
        ),
      );
    } catch (error) {
      const routeError = toRouteError(error, "Yorumlar okunamadi.");
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/albums/:photoId/comments", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: ALBUM_COMMENT_IP_LIMIT,
      scope: "compat:albums:comments:create",
      userId: user.id,
      userLimit: ALBUM_COMMENT_USER_LIMIT,
      windowMs: ALBUM_COMMENT_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { photoId } = parsePhotoParams({
        photoId: c.req.param("photoId"),
      });
      const { parentId, text } = parseCommentBody(await c.req.json().catch(() => ({})));
      const viewerSupabase = createViewerSupabaseClient(c);
      if (!viewerSupabase) return c.json({ error: "Unauthorized" }, 401);
      const blockedActorIds = await loadSqlBlockedActorSet(adminSupabase, user.id);

      const { data: photoRow, error: photoError } = await adminSupabase
        .from("album_photos")
        .select("id,user_id,event_id")
        .eq("id", photoId)
        .maybeSingle();
      if (photoError) {
        throw new Error(photoError.message);
      }
      if (!photoRow?.id) {
        return c.json({ error: "Album bulunamadi." }, 404);
      }

      const eventId = String(photoRow.event_id || "").trim();
      const { data: eventRow, error: eventError } = eventId
        ? await adminSupabase.from("events").select("id,club_id").eq("id", eventId).maybeSingle()
        : { data: null, error: null };
      if (eventError) {
        throw new Error(eventError.message);
      }

      if (
        blockedActorIds.has(String(photoRow.user_id || "").trim()) ||
        blockedActorIds.has(String(eventRow?.club_id || "").trim())
      ) {
        return c.json({ error: "Bu albumle etkilesim kuramazsiniz." }, 403);
      }

      const normalizedParentId = String(parentId || "").trim();
      if (normalizedParentId) {
        const { data: parentComment, error: parentError } = await viewerSupabase
          .from("album_photo_comments")
          .select("id,photo_id,user_id")
          .eq("id", normalizedParentId)
          .maybeSingle();
        if (parentError) {
          throw new Error(parentError.message);
        }
        if (!parentComment?.id || String(parentComment.photo_id || "") !== photoId) {
          return c.json({ error: "Yanit verilen yorum bulunamadi." }, 400);
        }
        if (blockedActorIds.has(String(parentComment.user_id || "").trim())) {
          return c.json({ error: "Bu yorumla etkilesim kuramazsiniz." }, 403);
        }
      }

      const { data, error } = await viewerSupabase
        .from("album_photo_comments")
        .insert({
          body: text,
          parent_id: normalizedParentId || null,
          photo_id: photoId,
          user_id: user.id,
        })
        .select("id,user_id,parent_id,body,created_at")
        .single();
      if (error) {
        throw new Error(error.message);
      }

      const { data: profile, error: profileError } = await viewerSupabase
        .from("profiles")
        .select("user_id,username,name,club_name,profile_image_path,university")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profileError) {
        throw new Error(profileError.message);
      }
      await recordSecurityAuditEvent({
        action: "album.comment.create",
        adminSupabase,
        c,
        metadata: { hasParent: Boolean(normalizedParentId) },
        resourceId: String((data as AlbumCommentRow).id || ""),
        resourceType: "album_comment",
        result: "success",
        userId: user.id,
      });
      await trackSecurityDetectionSignal({
        action: "album.comment.create",
        adminSupabase,
        c,
        metadata: { hasParent: Boolean(normalizedParentId) },
        resourceId: photoId,
        resourceType: "album",
        result: "success",
        severity: "high",
        signalType: "spam",
        threshold: 12,
        userId: user.id,
        windowMs: 10 * 60_000,
      });

      return c.json(
        toCommentResponse(data as AlbumCommentRow, (profile as ProfileRow | null) ?? null, timeAgo),
      );
    } catch (error) {
      const routeError = toRouteError(error, "Yorum eklenemedi.");
      if (routeError.status >= 500) {
        logError("albums/comments/create", "album-comment-create-failed", error, {
          userId: user.id,
        });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.delete("/make-server-e3557d40/albums/:photoId/comments/:commentId", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: ALBUM_COMMENT_IP_LIMIT,
      scope: "compat:albums:comments:delete",
      userId: user.id,
      userLimit: ALBUM_COMMENT_USER_LIMIT,
      windowMs: ALBUM_COMMENT_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { commentId, photoId } = parsePhotoCommentParams({
        commentId: c.req.param("commentId"),
        photoId: c.req.param("photoId"),
      });
      const { data: commentRow, error: commentError } = await adminSupabase
        .from("album_photo_comments")
        .select("id,user_id,photo_id")
        .eq("id", commentId)
        .maybeSingle();
      if (commentError) {
        throw new Error(commentError.message);
      }
      if (!commentRow?.id || String(commentRow.photo_id || "") !== photoId) {
        return c.json({ error: "Yorum bulunamadi" }, 404);
      }

      const { data: photoRow, error: photoError } = await adminSupabase
        .from("album_photos")
        .select("id,user_id,event_id")
        .eq("id", photoId)
        .maybeSingle();
      if (photoError) {
        throw new Error(photoError.message);
      }

      const eventId = String(photoRow?.event_id || "").trim();
      const { data: eventRow, error: eventError } = eventId
        ? await adminSupabase.from("events").select("id,club_id").eq("id", eventId).maybeSingle()
        : { data: null, error: null };
      if (eventError) {
        throw new Error(eventError.message);
      }

      const commentOwnerId = String(commentRow.user_id || "").trim();
      const photoOwnerId = String(photoRow?.user_id || "").trim();
      const clubOwnerId = String(eventRow?.club_id || "").trim();
      const canDelete =
        (commentOwnerId && commentOwnerId === String(user.id)) ||
        (photoOwnerId && photoOwnerId === String(user.id)) ||
        (clubOwnerId && clubOwnerId === String(user.id));
      if (!canDelete) {
        return c.json({ error: "Bu yorumu silme yetkiniz yok." }, 403);
      }

      const { error } = await adminSupabase
        .from("album_photo_comments")
        .delete()
        .eq("id", commentId);
      if (
        error &&
        !String(error.message || "")
          .toLowerCase()
          .includes("no rows")
      ) {
        logError("albums/comments/delete", "album-comment-delete-provider-failed", error, {
          commentId,
          photoId,
          userId: user.id,
        });
        return c.json({ error: "Yorum silinemedi." }, 500);
      }
      await recordSecurityAuditEvent({
        action: "album.comment.delete",
        adminSupabase,
        c,
        resourceId: commentId,
        resourceType: "album_comment",
        result: "success",
        userId: user.id,
      });

      return c.json({ success: true });
    } catch (error) {
      const routeError = toRouteError(error, "Yorum silinemedi.");
      if (routeError.status >= 500) {
        logError("albums/comments/delete", "album-comment-delete-failed", error, {
          userId: user.id,
        });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });
}
