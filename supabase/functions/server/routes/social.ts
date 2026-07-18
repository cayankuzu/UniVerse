import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import type {
  EdgeRouteApp,
  KvBlockedRecord,
  KvFollowRecord,
  KvFollowRequestRecord,
  KvNotificationRecord,
  KvProfileRecord,
  ServerRouteDeps,
} from "../types.ts";
import { enforceCompatMutationRateLimit } from "./compatMutationRateLimit.ts";
import { resolveCompatProfilePrivacy } from "./compatProfilePrivacy.ts";
import {
  CompatRouteValidationError,
  parseNotificationParams,
  parseUsernameParams,
} from "./compatRouteValidation.ts";
import {
  invalidateSqlBlockedActorSet,
  isSqlBlockedPair,
  loadSqlBlockedActorSet,
} from "../services/sqlBlockedState.ts";

const SOCIAL_MUTATION_WINDOW_MS = 60_000;
const SOCIAL_MUTATION_USER_LIMIT = 30;
const SOCIAL_MUTATION_IP_LIMIT = 60;
const NOTIFICATION_MUTATION_WINDOW_MS = 60_000;
const NOTIFICATION_MUTATION_USER_LIMIT = 120;
const NOTIFICATION_MUTATION_IP_LIMIT = 240;

function toRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof CompatRouteValidationError) {
    return {
      message: error.message,
      status: error.status,
    };
  }

  return {
    message: fallbackMessage,
    status: 500,
  };
}

function mapBlockedRecord(item: KvBlockedRecord) {
  return {
    accountType: item.accountType || "student",
    blockedAt: item.blockedAt || "",
    image: item.image || "",
    isPrivate: resolveCompatProfilePrivacy(item.accountType, item.isPrivate),
    name: item.name || "",
    university: item.university || "",
    userId: item.userId,
    username: item.username || "",
  };
}

async function clearCompatRelationshipState(userId: string, targetUserId: string) {
  const [
    followingRows,
    followerRows,
    sentRequests,
    receivedRequests,
    targetFollowingRows,
    targetFollowerRows,
    targetSentRequests,
    targetReceivedRequests,
  ] = await Promise.all([
    kv.get<KvFollowRecord[]>(`following:${userId}`).then((value) => value || []),
    kv.get<KvFollowRecord[]>(`followers:${userId}`).then((value) => value || []),
    kv.get<KvFollowRequestRecord[]>(`follow_requests_sent:${userId}`).then((value) => value || []),
    kv
      .get<KvFollowRequestRecord[]>(`follow_requests_received:${userId}`)
      .then((value) => value || []),
    kv.get<KvFollowRecord[]>(`following:${targetUserId}`).then((value) => value || []),
    kv.get<KvFollowRecord[]>(`followers:${targetUserId}`).then((value) => value || []),
    kv
      .get<KvFollowRequestRecord[]>(`follow_requests_sent:${targetUserId}`)
      .then((value) => value || []),
    kv
      .get<KvFollowRequestRecord[]>(`follow_requests_received:${targetUserId}`)
      .then((value) => value || []),
  ]);

  await kv.mset([
    {
      key: `following:${userId}`,
      value: followingRows.filter((item) => item.userId !== targetUserId),
    },
    {
      key: `followers:${userId}`,
      value: followerRows.filter((item) => item.userId !== targetUserId),
    },
    {
      key: `follow_requests_sent:${userId}`,
      value: sentRequests.filter((item) => item.toUserId !== targetUserId),
    },
    {
      key: `follow_requests_received:${userId}`,
      value: receivedRequests.filter((item) => item.fromUserId !== targetUserId),
    },
    {
      key: `following:${targetUserId}`,
      value: targetFollowingRows.filter((item) => item.userId !== userId),
    },
    {
      key: `followers:${targetUserId}`,
      value: targetFollowerRows.filter((item) => item.userId !== userId),
    },
    {
      key: `follow_requests_sent:${targetUserId}`,
      value: targetSentRequests.filter((item) => item.toUserId !== userId),
    },
    {
      key: `follow_requests_received:${targetUserId}`,
      value: targetReceivedRequests.filter((item) => item.fromUserId !== userId),
    },
  ]);
}

export function registerSocialRoutes(app: EdgeRouteApp, deps: ServerRouteDeps) {
  const { adminSupabase, getUser, timeAgo } = deps;

  async function clearCompatNotificationsBetweenUsers(userId: string, targetUserId: string) {
    const [viewerNotifications, targetNotifications] = await Promise.all([
      kv.get<KvNotificationRecord[]>(`notifications:${userId}`).then((value) => value || []),
      kv.get<KvNotificationRecord[]>(`notifications:${targetUserId}`).then((value) => value || []),
    ]);

    await kv.mset([
      {
        key: `notifications:${userId}`,
        value: viewerNotifications.filter((item) => String(item.fromUserId || "") !== targetUserId),
      },
      {
        key: `notifications:${targetUserId}`,
        value: targetNotifications.filter((item) => String(item.fromUserId || "") !== userId),
      },
    ]);
  }

  app.get("/make-server-e3557d40/blocks", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const blockedRows = (await kv.get<KvBlockedRecord[]>(`blocked:${user.id}`)) || [];
      return c.json(
        blockedRows
          .map(mapBlockedRecord)
          .sort(
            (a, b) =>
              new Date(String(b.blockedAt || 0)).getTime() -
              new Date(String(a.blockedAt || 0)).getTime(),
          ),
      );
    } catch (error) {
      logError("social/blocks", "block-list-load-failed", error, { userId: user.id });
      return c.json({ error: "Engellenen kullanicilar okunamadi." }, 500);
    }
  });

  app.get("/make-server-e3557d40/blocks/check/:username", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ blocked: false });

    try {
      const { username } = parseUsernameParams({
        username: c.req.param("username"),
      });
      const targetUserId = await kv.get<string>(`idx:username:${username}`);
      if (!targetUserId) return c.json({ blocked: false });
      return c.json({
        blocked: await isSqlBlockedPair(adminSupabase, user.id, targetUserId),
      });
    } catch (error) {
      const routeError = toRouteError(error, "Engel durumu okunamadi.");
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/blocks/:username", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: SOCIAL_MUTATION_IP_LIMIT,
      scope: "compat:social:block",
      userId: user.id,
      userLimit: SOCIAL_MUTATION_USER_LIMIT,
      windowMs: SOCIAL_MUTATION_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { username } = parseUsernameParams({
        username: c.req.param("username"),
      });
      const targetUserId = await kv.get<string>(`idx:username:${username}`);
      if (!targetUserId) return c.json({ error: "User not found" }, 404);

      const [targetProfile, blockedRows] = await Promise.all([
        kv.get<KvProfileRecord>(`profile:${targetUserId}`),
        kv.get<KvBlockedRecord[]>(`blocked:${user.id}`).then((value) => value || []),
      ]);
      const isBlocked = blockedRows.some((item) => item.userId === targetUserId);

      if (isBlocked) {
        await Promise.all([
          kv.set(
            `blocked:${user.id}`,
            blockedRows.filter((item) => item.userId !== targetUserId),
          ),
          adminSupabase
            .from("blocks")
            .delete()
            .eq("blocker_id", user.id)
            .eq("blocked_id", targetUserId),
        ]);
        invalidateSqlBlockedActorSet(user.id);
        invalidateSqlBlockedActorSet(targetUserId);
        await clearCompatRelationshipState(user.id, targetUserId);
        return c.json({ blocked: false });
      }

      const nextBlockedRows = [
        ...blockedRows,
        {
          accountType: targetProfile?.accountType || "student",
          blockedAt: new Date().toISOString(),
          image: targetProfile?.profileImage || "",
          isPrivate: resolveCompatProfilePrivacy(
            targetProfile?.accountType,
            targetProfile?.isPrivate,
          ),
          name: targetProfile?.name || targetProfile?.clubName || "",
          university: targetProfile?.university || "",
          userId: targetUserId,
          username,
        } satisfies KvBlockedRecord,
      ];
      const [
        followingRows,
        followerRows,
        sentRequests,
        receivedRequests,
        targetFollowingRows,
        targetFollowerRows,
        targetSentRequests,
        targetReceivedRequests,
      ] = await Promise.all([
        kv.get<KvFollowRecord[]>(`following:${user.id}`).then((value) => value || []),
        kv.get<KvFollowRecord[]>(`followers:${user.id}`).then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_sent:${user.id}`)
          .then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_received:${user.id}`)
          .then((value) => value || []),
        kv.get<KvFollowRecord[]>(`following:${targetUserId}`).then((value) => value || []),
        kv.get<KvFollowRecord[]>(`followers:${targetUserId}`).then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_sent:${targetUserId}`)
          .then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_received:${targetUserId}`)
          .then((value) => value || []),
      ]);
      await Promise.all([
        kv.mset([
          { key: `blocked:${user.id}`, value: nextBlockedRows },
          // Clean blocker's side
          {
            key: `following:${user.id}`,
            value: followingRows.filter((item) => item.userId !== targetUserId),
          },
          {
            key: `followers:${user.id}`,
            value: followerRows.filter((item) => item.userId !== targetUserId),
          },
          {
            key: `follow_requests_sent:${user.id}`,
            value: sentRequests.filter((item) => item.toUserId !== targetUserId),
          },
          {
            key: `follow_requests_received:${user.id}`,
            value: receivedRequests.filter((item) => item.fromUserId !== targetUserId),
          },
          // Clean target's side — they should no longer see the blocker
          {
            key: `following:${targetUserId}`,
            value: targetFollowingRows.filter((item) => item.userId !== user.id),
          },
          {
            key: `followers:${targetUserId}`,
            value: targetFollowerRows.filter((item) => item.userId !== user.id),
          },
          {
            key: `follow_requests_sent:${targetUserId}`,
            value: targetSentRequests.filter((item) => item.toUserId !== user.id),
          },
          {
            key: `follow_requests_received:${targetUserId}`,
            value: targetReceivedRequests.filter((item) => item.fromUserId !== user.id),
          },
        ]),
        adminSupabase
          .from("blocks")
          .upsert(
            { blocked_id: targetUserId, blocker_id: user.id },
            { ignoreDuplicates: true, onConflict: "blocker_id,blocked_id" },
          ),
      ]);
      invalidateSqlBlockedActorSet(user.id);
      invalidateSqlBlockedActorSet(targetUserId);
      await clearCompatRelationshipState(user.id, targetUserId);
      await clearCompatNotificationsBetweenUsers(user.id, targetUserId);
      return c.json({ blocked: true });
    } catch (error) {
      const routeError = toRouteError(error, "Engel islemi tamamlanamadi.");
      if (routeError.status >= 500) {
        logError("social/blocks/toggle", "block-toggle-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.delete("/make-server-e3557d40/blocks/:username", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: SOCIAL_MUTATION_IP_LIMIT,
      scope: "compat:social:unblock",
      userId: user.id,
      userLimit: SOCIAL_MUTATION_USER_LIMIT,
      windowMs: SOCIAL_MUTATION_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { username } = parseUsernameParams({
        username: c.req.param("username"),
      });
      const targetUserId = await kv.get<string>(`idx:username:${username}`);
      if (!targetUserId) return c.json({ error: "User not found" }, 404);
      const blockedRows = (await kv.get<KvBlockedRecord[]>(`blocked:${user.id}`)) || [];
      await Promise.all([
        kv.set(
          `blocked:${user.id}`,
          blockedRows.filter((item) => item.userId !== targetUserId),
        ),
        adminSupabase
          .from("blocks")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", targetUserId),
      ]);
      invalidateSqlBlockedActorSet(user.id);
      invalidateSqlBlockedActorSet(targetUserId);
      await clearCompatRelationshipState(user.id, targetUserId);
      return c.json({ blocked: false });
    } catch (error) {
      const routeError = toRouteError(error, "Engel kaldirilamadi.");
      if (routeError.status >= 500) {
        logError("social/blocks/delete", "block-delete-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.get("/make-server-e3557d40/notifications", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const notifications =
        (await kv.get<KvNotificationRecord[]>(`notifications:${user.id}`)) || [];
      const blockedActorIds = await loadSqlBlockedActorSet(adminSupabase, user.id);
      return c.json(
        notifications
          .filter((item) => !blockedActorIds.has(String(item.fromUserId || "").trim()))
          .map((item) => ({
            ...item,
            time: timeAgo(item.createdAt),
          })),
      );
    } catch (error) {
      logError("social/notifications", "notification-list-load-failed", error, { userId: user.id });
      return c.json({ error: "Bildirimler okunamadi." }, 500);
    }
  });

  app.put("/make-server-e3557d40/notifications/read-all", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: NOTIFICATION_MUTATION_IP_LIMIT,
      scope: "compat:social:notifications:read-all",
      userId: user.id,
      userLimit: NOTIFICATION_MUTATION_USER_LIMIT,
      windowMs: NOTIFICATION_MUTATION_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const notifications =
        (await kv.get<KvNotificationRecord[]>(`notifications:${user.id}`)) || [];
      await kv.set(
        `notifications:${user.id}`,
        notifications.map((item) => ({ ...item, read: true })),
      );
      return c.json({ success: true });
    } catch (error) {
      logError("social/notifications/read-all", "notification-read-all-failed", error, {
        userId: user.id,
      });
      return c.json({ error: "Bildirimler guncellenemedi." }, 500);
    }
  });

  app.put("/make-server-e3557d40/notifications/:id/read", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: NOTIFICATION_MUTATION_IP_LIMIT,
      scope: "compat:social:notifications:read-one",
      userId: user.id,
      userLimit: NOTIFICATION_MUTATION_USER_LIMIT,
      windowMs: NOTIFICATION_MUTATION_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { id } = parseNotificationParams({
        id: c.req.param("id"),
      });
      const notifications =
        (await kv.get<KvNotificationRecord[]>(`notifications:${user.id}`)) || [];
      const nextNotifications = notifications.map((item) =>
        String(item.id || "") === id ? { ...item, read: true } : item,
      );
      await kv.set(`notifications:${user.id}`, nextNotifications);
      const changed = nextNotifications.some(
        (item) => String(item.id || "") === id && item.read === true,
      );
      return c.json({ success: changed });
    } catch (error) {
      const routeError = toRouteError(error, "Bildirim guncellenemedi.");
      if (routeError.status >= 500) {
        logError("social/notifications/read-one", "notification-read-failed", error, {
          userId: user.id,
        });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });
}
