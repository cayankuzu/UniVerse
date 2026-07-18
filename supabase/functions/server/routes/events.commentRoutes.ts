import { logError } from "../logging.ts";
import {
  recordSecurityAuditEvent,
  trackSecurityDetectionSignal,
} from "../services/securityAudit.ts";
import type { ServerRouteDeps } from "../types.ts";
import { createViewerSupabaseClient } from "../services/viewerSupabase.ts";
import { enforceCompatMutationRateLimit } from "./compatMutationRateLimit.ts";
import { isSqlBlockedPair, loadSqlBlockedActorSet } from "../services/sqlBlockedState.ts";
import {
  parseCommentBody,
  parseEventCommentParams,
  parseEventParams,
} from "./compatRouteValidation.ts";
import type { EventRouteApp } from "./eventsRouteHelpers.ts";
import { toRouteError } from "./eventsRouteHelpers.ts";

const EVENT_COMMENT_WINDOW_MS = 60_000;
const EVENT_COMMENT_USER_LIMIT = 20;
const EVENT_COMMENT_IP_LIMIT = 40;

type EventCommentRow = {
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
  row: EventCommentRow,
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

export function registerEventCommentRoutes(
  app: EventRouteApp,
  deps: Pick<ServerRouteDeps, "adminSupabase" | "getUser" | "timeAgo">,
) {
  const { adminSupabase, getUser, timeAgo } = deps;

  app.get("/make-server-e3557d40/events/:id/comments", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const { id } = parseEventParams({
        id: c.req.param("id"),
      });
      const viewerSupabase = createViewerSupabaseClient(c);
      if (!viewerSupabase) return c.json({ error: "Unauthorized" }, 401);

      const { data: rows, error } = await viewerSupabase
        .from("event_comments")
        .select("id,user_id,parent_id,body,created_at")
        .eq("event_id", id)
        .order("created_at", { ascending: true });
      if (error) {
        throw new Error(error.message);
      }

      const { data: eventRow, error: eventError } = await adminSupabase
        .from("events")
        .select("id,club_id")
        .eq("id", id)
        .maybeSingle();
      if (eventError) {
        throw new Error(eventError.message);
      }
      if (await isSqlBlockedPair(adminSupabase, user.id, String(eventRow?.club_id || ""))) {
        return c.json({ error: "Bu etkinlige erisemiyorsunuz." }, 403);
      }

      const blockedActorIds = await loadSqlBlockedActorSet(adminSupabase, user.id);
      const rowMap = new Map(
        ((Array.isArray(rows) ? rows : []) as EventCommentRow[]).map((row) => [row.id, row]),
      );
      const commentRows = ((Array.isArray(rows) ? rows : []) as EventCommentRow[]).filter((row) => {
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
        action: "event.comments.read",
        adminSupabase,
        c,
        metadata: { commentCount: commentRows.length },
        resourceId: id,
        resourceType: "event",
        result: "success",
        userId: user.id,
      });
      await trackSecurityDetectionSignal({
        action: "event.comments.read",
        adminSupabase,
        c,
        metadata: { commentCount: commentRows.length },
        resourceId: id,
        resourceType: "event",
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

  app.post("/make-server-e3557d40/events/:id/comments", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: EVENT_COMMENT_IP_LIMIT,
      scope: "compat:events:comments:create",
      userId: user.id,
      userLimit: EVENT_COMMENT_USER_LIMIT,
      windowMs: EVENT_COMMENT_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { id } = parseEventParams({
        id: c.req.param("id"),
      });
      const { parentId, text } = parseCommentBody(await c.req.json().catch(() => ({})));
      const viewerSupabase = createViewerSupabaseClient(c);
      if (!viewerSupabase) return c.json({ error: "Unauthorized" }, 401);
      const blockedActorIds = await loadSqlBlockedActorSet(adminSupabase, user.id);

      const { data: eventRow, error: eventError } = await adminSupabase
        .from("events")
        .select("id,club_id")
        .eq("id", id)
        .maybeSingle();
      if (eventError) {
        throw new Error(eventError.message);
      }
      if (!eventRow?.id) {
        return c.json({ error: "Etkinlik bulunamadi." }, 404);
      }
      if (blockedActorIds.has(String(eventRow.club_id || "").trim())) {
        return c.json({ error: "Bu etkinlikle etkilesim kuramazsiniz." }, 403);
      }

      const normalizedParentId = String(parentId || "").trim();
      if (normalizedParentId) {
        const { data: parentComment, error: parentError } = await viewerSupabase
          .from("event_comments")
          .select("id,event_id,user_id")
          .eq("id", normalizedParentId)
          .maybeSingle();
        if (parentError) {
          throw new Error(parentError.message);
        }
        if (!parentComment?.id || String(parentComment.event_id || "") !== id) {
          return c.json({ error: "Yanit verilen yorum bulunamadi." }, 400);
        }
        if (blockedActorIds.has(String(parentComment.user_id || "").trim())) {
          return c.json({ error: "Bu yorumla etkilesim kuramazsiniz." }, 403);
        }
      }

      const { data, error } = await viewerSupabase
        .from("event_comments")
        .insert({
          body: text,
          event_id: id,
          parent_id: normalizedParentId || null,
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
        action: "event.comment.create",
        adminSupabase,
        c,
        metadata: { hasParent: Boolean(normalizedParentId) },
        resourceId: String((data as EventCommentRow).id || ""),
        resourceType: "event_comment",
        result: "success",
        userId: user.id,
      });
      await trackSecurityDetectionSignal({
        action: "event.comment.create",
        adminSupabase,
        c,
        metadata: { hasParent: Boolean(normalizedParentId) },
        resourceId: id,
        resourceType: "event",
        result: "success",
        severity: "high",
        signalType: "spam",
        threshold: 12,
        userId: user.id,
        windowMs: 10 * 60_000,
      });

      return c.json(
        toCommentResponse(data as EventCommentRow, (profile as ProfileRow | null) ?? null, timeAgo),
      );
    } catch (error) {
      const routeError = toRouteError(error, "Yorum eklenemedi.");
      if (routeError.status >= 500) {
        logError("events/comments/create", "event-comment-create-failed", error, {
          userId: user.id,
        });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.delete("/make-server-e3557d40/events/:id/comments/:commentId", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: EVENT_COMMENT_IP_LIMIT,
      scope: "compat:events:comments:delete",
      userId: user.id,
      userLimit: EVENT_COMMENT_USER_LIMIT,
      windowMs: EVENT_COMMENT_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { commentId, id } = parseEventCommentParams({
        commentId: c.req.param("commentId"),
        id: c.req.param("id"),
      });
      const { data: commentRow, error: commentError } = await adminSupabase
        .from("event_comments")
        .select("id,user_id,event_id")
        .eq("id", commentId)
        .maybeSingle();
      if (commentError) {
        throw new Error(commentError.message);
      }
      if (!commentRow?.id || String(commentRow.event_id || "") !== id) {
        return c.json({ error: "Yorum bulunamadi" }, 404);
      }

      const { data: eventRow, error: eventError } = await adminSupabase
        .from("events")
        .select("id,club_id")
        .eq("id", id)
        .maybeSingle();
      if (eventError) {
        throw new Error(eventError.message);
      }

      const commentOwnerId = String(commentRow.user_id || "").trim();
      const eventOwnerId = String(eventRow?.club_id || "").trim();
      const canDelete =
        (commentOwnerId && commentOwnerId === String(user.id)) ||
        (eventOwnerId && eventOwnerId === String(user.id));
      if (!canDelete) {
        return c.json({ error: "Bu yorumu silme yetkiniz yok." }, 403);
      }

      const { error } = await adminSupabase.from("event_comments").delete().eq("id", commentId);
      if (
        error &&
        !String(error.message || "")
          .toLowerCase()
          .includes("no rows")
      ) {
        logError("events/comments/delete", "event-comment-delete-provider-failed", error, {
          commentId,
          eventId: id,
          userId: user.id,
        });
        return c.json({ error: "Yorum silinemedi." }, 500);
      }
      await recordSecurityAuditEvent({
        action: "event.comment.delete",
        adminSupabase,
        c,
        resourceId: commentId,
        resourceType: "event_comment",
        result: "success",
        userId: user.id,
      });

      return c.json({ success: true });
    } catch (error) {
      const routeError = toRouteError(error, "Yorum silinemedi.");
      if (routeError.status >= 500) {
        logError("events/comments/delete", "event-comment-delete-failed", error, {
          userId: user.id,
        });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });
}
