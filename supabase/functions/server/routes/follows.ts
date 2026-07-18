import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import type { EdgeRouteApp, KvNotificationRecord, ServerRouteDeps } from "../types.ts";
import { enforceCompatMutationRateLimit } from "./compatMutationRateLimit.ts";
import { parseUsernameParams } from "./compatRouteValidation.ts";
import {
  hasFollowRecordForUserId,
  hasIncomingFollowRequestForUserId,
  hasOutgoingFollowRequestForUserId,
  isSelfTarget,
  upsertFollowRecordByUserId,
  upsertIncomingFollowRequestByUserId,
  upsertOutgoingFollowRequestByUserId,
} from "./follows.helpers.ts";
import {
  buildFollowListRecord,
  buildFollowNotification,
  buildFollowRequestRecord,
  buildOutgoingFollowRequestRecord,
  targetRequiresFollowRequest,
  toFollowRouteError,
} from "./follows.records.ts";

const FOLLOW_MUTATION_WINDOW_MS = 60_000;
const FOLLOW_MUTATION_USER_LIMIT = 30;
const FOLLOW_MUTATION_IP_LIMIT = 60;

export function registerFollowRoutes(app: EdgeRouteApp, deps: ServerRouteDeps) {
  const { addNotification, getUser, isKvBlockedPair, timeAgo } = deps;

  const removeNotifications = async (
    userId: string,
    matcher: (item: KvNotificationRecord) => boolean,
  ) => {
    const notifications = (await kv.get<KvNotificationRecord[]>(`notifications:${userId}`)) || [];
    const nextNotifications = notifications.filter((item) => !matcher(item));
    if (nextNotifications.length !== notifications.length) {
      await kv.set(`notifications:${userId}`, nextNotifications);
    }
  };

  app.get("/make-server-e3557d40/follows/status/:username", async (c) => {
    try {
      const user = await getUser(c);
      if (!user) return c.json({ status: "none" });

      const { username } = parseUsernameParams({
        username: c.req.param("username"),
      });
      const targetUserId = await kv.get<string>(`idx:username:${username}`);
      if (!targetUserId) return c.json({ status: "none" });
      if (isSelfTarget(user.id, targetUserId)) return c.json({ status: "none" });
      if (await isKvBlockedPair(user.id, targetUserId)) return c.json({ status: "none" });

      const [targetProfile, followingRows, sentRequests] = await Promise.all([
        kv.get<KvProfileRecord>(`profile:${targetUserId}`),
        kv.get<KvFollowRecord[]>(`following:${user.id}`).then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_sent:${user.id}`)
          .then((value) => value || []),
      ]);

      if (hasFollowRecordForUserId(followingRows, targetUserId)) {
        return c.json({ status: "following" });
      }
      if (
        targetRequiresFollowRequest(targetProfile) &&
        hasOutgoingFollowRequestForUserId(sentRequests, targetUserId)
      ) {
        return c.json({ status: "requested" });
      }
      return c.json({ status: "none" });
    } catch (error) {
      const routeError = toFollowRouteError(error, "Takip durumu okunamadi.");
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/follows/:username", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: FOLLOW_MUTATION_IP_LIMIT,
      scope: "compat:follows:toggle",
      userId: user.id,
      userLimit: FOLLOW_MUTATION_USER_LIMIT,
      windowMs: FOLLOW_MUTATION_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { username } = parseUsernameParams({
        username: c.req.param("username"),
      });
      const targetUserId = await kv.get<string>(`idx:username:${username}`);
      if (!targetUserId) return c.json({ error: "User not found" }, 404);
      if (isSelfTarget(user.id, targetUserId)) {
        return c.json({ error: "Kendini takip edemezsin." }, 400);
      }
      if (await isKvBlockedPair(user.id, targetUserId)) {
        return c.json({ error: "Bu kullaniciyla takip islemi yapilamaz." }, 403);
      }

      const [
        myProfile,
        targetProfile,
        followingRows,
        sentRequests,
        targetFollowers,
        targetRequests,
      ] = await Promise.all([
        kv.get<KvProfileRecord>(`profile:${user.id}`),
        kv.get<KvProfileRecord>(`profile:${targetUserId}`),
        kv.get<KvFollowRecord[]>(`following:${user.id}`).then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_sent:${user.id}`)
          .then((value) => value || []),
        kv.get<KvFollowRecord[]>(`followers:${targetUserId}`).then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_received:${targetUserId}`)
          .then((value) => value || []),
      ]);

      const isFollowing = hasFollowRecordForUserId(followingRows, targetUserId);
      const hasSentRequest = hasOutgoingFollowRequestForUserId(sentRequests, targetUserId);
      const shouldSendRequest = targetRequiresFollowRequest(targetProfile);

      if (isFollowing) {
        await kv.mset([
          {
            key: `following:${user.id}`,
            value: followingRows.filter((item) => item.userId !== targetUserId),
          },
          {
            key: `followers:${targetUserId}`,
            value: targetFollowers.filter((item) => item.userId !== user.id),
          },
          {
            key: `follow_requests_sent:${user.id}`,
            value: sentRequests.filter((item) => item.toUserId !== targetUserId),
          },
          {
            key: `follow_requests_received:${targetUserId}`,
            value: targetRequests.filter((item) => item.fromUserId !== user.id),
          },
        ]);
        await Promise.all([
          removeNotifications(
            targetUserId,
            (item) => item.type === "follow" && item.fromUserId === user.id,
          ),
          removeNotifications(
            user.id,
            (item) => item.type === "follow_accepted" && item.fromUserId === targetUserId,
          ),
          removeNotifications(
            targetUserId,
            (item) => item.type === "follow_request" && item.fromUserId === user.id,
          ),
        ]);
        return c.json({ status: "none" });
      }

      if (hasSentRequest && shouldSendRequest) {
        await kv.mset([
          {
            key: `follow_requests_sent:${user.id}`,
            value: sentRequests.filter((item) => item.toUserId !== targetUserId),
          },
          {
            key: `follow_requests_received:${targetUserId}`,
            value: targetRequests.filter((item) => item.fromUserId !== user.id),
          },
        ]);
        await removeNotifications(
          targetUserId,
          (item) => item.type === "follow_request" && item.fromUserId === user.id,
        );
        return c.json({ status: "none" });
      }

      if (shouldSendRequest) {
        const nextSentRequests = upsertOutgoingFollowRequestByUserId(
          sentRequests,
          buildOutgoingFollowRequestRecord(targetUserId, username),
        );
        const nextTargetRequests = upsertIncomingFollowRequestByUserId(
          targetRequests,
          buildFollowRequestRecord(myProfile, user.id, username),
        );
        await kv.mset([
          { key: `follow_requests_sent:${user.id}`, value: nextSentRequests },
          { key: `follow_requests_received:${targetUserId}`, value: nextTargetRequests },
        ]);
        await removeNotifications(
          targetUserId,
          (item) => item.type === "follow_request" && item.fromUserId === user.id,
        );
        await addNotification(targetUserId, {
          fromImage: myProfile?.profileImage || "",
          fromName: myProfile?.name || myProfile?.clubName || "",
          fromUserId: user.id,
          fromUsername: myProfile?.username || "",
          message: "seni takip etmek istiyor",
          targetType: "profile",
          type: "follow_request",
        });
        return c.json({ status: "requested" });
      }

      const nextFollowingRows = upsertFollowRecordByUserId(
        followingRows,
        buildFollowListRecord(targetProfile, targetUserId, username),
      );
      const nextTargetFollowers = upsertFollowRecordByUserId(
        targetFollowers,
        buildFollowListRecord(myProfile, user.id, myProfile?.username || ""),
      );
      await kv.mset([
        { key: `following:${user.id}`, value: nextFollowingRows },
        { key: `followers:${targetUserId}`, value: nextTargetFollowers },
        {
          key: `follow_requests_sent:${user.id}`,
          value: sentRequests.filter((item) => item.toUserId !== targetUserId),
        },
        {
          key: `follow_requests_received:${targetUserId}`,
          value: targetRequests.filter((item) => item.fromUserId !== user.id),
        },
      ]);
      await removeNotifications(
        targetUserId,
        (item) =>
          (item.type === "follow" || item.type === "follow_request") && item.fromUserId === user.id,
      );
      await addNotification(
        targetUserId,
        buildFollowNotification(myProfile, user.id, "seni takip etmeye basladi"),
      );
      return c.json({ status: "following" });
    } catch (error) {
      const routeError = toFollowRouteError(error, "Takip durumu guncellenemedi.");
      if (routeError.status >= 500) {
        logError("follows/toggle", "follow-toggle-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.get("/make-server-e3557d40/follows/requests", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const requests =
        (await kv.get<KvFollowRequestRecord[]>(`follow_requests_received:${user.id}`)) || [];
      return c.json(
        requests.map((item) => ({
          accountType: item.fromAccountType || "student",
          image: item.fromImage || "",
          name: item.fromName || "",
          time: timeAgo(item.sentAt || new Date().toISOString()),
          username: item.fromUsername || "",
        })),
      );
    } catch (error) {
      logError("follows/requests", "follow-requests-load-failed", error, { userId: user.id });
      return c.json({ error: "Istekler okunamadi." }, 500);
    }
  });

  app.post("/make-server-e3557d40/follows/requests/:username/accept", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: FOLLOW_MUTATION_IP_LIMIT,
      scope: "compat:follows:accept",
      userId: user.id,
      userLimit: FOLLOW_MUTATION_USER_LIMIT,
      windowMs: FOLLOW_MUTATION_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { username } = parseUsernameParams({
        username: c.req.param("username"),
      });
      const fromUserId = await kv.get<string>(`idx:username:${username}`);
      if (!fromUserId) return c.json({ error: "User not found" }, 404);
      if (isSelfTarget(user.id, fromUserId)) {
        return c.json({ error: "Kendi istegini kabul edemezsin." }, 400);
      }
      if (await isKvBlockedPair(user.id, fromUserId)) {
        return c.json({ error: "Bu kullaniciyla takip islemi yapilamaz." }, 403);
      }

      const [myProfile, fromProfile, receivedRequests, sentRequests, followerRows, followingRows] =
        await Promise.all([
          kv.get<KvProfileRecord>(`profile:${user.id}`),
          kv.get<KvProfileRecord>(`profile:${fromUserId}`),
          kv
            .get<KvFollowRequestRecord[]>(`follow_requests_received:${user.id}`)
            .then((value) => value || []),
          kv
            .get<KvFollowRequestRecord[]>(`follow_requests_sent:${fromUserId}`)
            .then((value) => value || []),
          kv.get<KvFollowRecord[]>(`followers:${user.id}`).then((value) => value || []),
          kv.get<KvFollowRecord[]>(`following:${fromUserId}`).then((value) => value || []),
        ]);

      const hasPendingRequest = hasIncomingFollowRequestForUserId(receivedRequests, fromUserId);
      const alreadyFollowing =
        hasFollowRecordForUserId(followerRows, fromUserId) &&
        hasFollowRecordForUserId(followingRows, user.id);
      if (!hasPendingRequest) {
        if (alreadyFollowing) return c.json({ success: true });
        return c.json({ error: "Takip istegi bulunamadi." }, 404);
      }

      const nextFollowerRows = upsertFollowRecordByUserId(
        followerRows,
        buildFollowListRecord(fromProfile, fromUserId, username),
      );
      const nextFollowingRows = upsertFollowRecordByUserId(
        followingRows,
        buildFollowListRecord(myProfile, user.id, myProfile?.username || ""),
      );

      await kv.mset([
        {
          key: `follow_requests_received:${user.id}`,
          value: receivedRequests.filter((item) => item.fromUserId !== fromUserId),
        },
        {
          key: `follow_requests_sent:${fromUserId}`,
          value: sentRequests.filter((item) => item.toUserId !== user.id),
        },
        { key: `followers:${user.id}`, value: nextFollowerRows },
        { key: `following:${fromUserId}`, value: nextFollowingRows },
      ]);
      await removeNotifications(
        user.id,
        (item) => item.type === "follow_request" && item.fromUserId === fromUserId,
      );
      await removeNotifications(
        fromUserId,
        (item) => item.type === "follow_accepted" && item.fromUserId === user.id,
      );

      await addNotification(
        fromUserId,
        buildFollowNotification(
          myProfile,
          user.id,
          "takip isteginizi kabul etti",
          "follow_accepted",
        ),
      );
      return c.json({ success: true });
    } catch (error) {
      const routeError = toFollowRouteError(error, "Takip istegi kabul edilemedi.");
      if (routeError.status >= 500) {
        logError("follows/requests/accept", "follow-request-accept-failed", error, {
          userId: user.id,
        });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/follows/requests/:username/reject", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: FOLLOW_MUTATION_IP_LIMIT,
      scope: "compat:follows:reject",
      userId: user.id,
      userLimit: FOLLOW_MUTATION_USER_LIMIT,
      windowMs: FOLLOW_MUTATION_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { username } = parseUsernameParams({
        username: c.req.param("username"),
      });
      const fromUserId = await kv.get<string>(`idx:username:${username}`);
      if (!fromUserId) return c.json({ error: "User not found" }, 404);
      if (isSelfTarget(user.id, fromUserId)) {
        return c.json({ error: "Kendi istegini reddedemezsin." }, 400);
      }
      if (await isKvBlockedPair(user.id, fromUserId)) {
        return c.json({ error: "Bu kullaniciyla takip islemi yapilamaz." }, 403);
      }

      const [receivedRequests, sentRequests] = await Promise.all([
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_received:${user.id}`)
          .then((value) => value || []),
        kv
          .get<KvFollowRequestRecord[]>(`follow_requests_sent:${fromUserId}`)
          .then((value) => value || []),
      ]);

      await kv.mset([
        {
          key: `follow_requests_received:${user.id}`,
          value: receivedRequests.filter((item) => item.fromUserId !== fromUserId),
        },
        {
          key: `follow_requests_sent:${fromUserId}`,
          value: sentRequests.filter((item) => item.toUserId !== user.id),
        },
      ]);
      await removeNotifications(
        user.id,
        (item) => item.type === "follow_request" && item.fromUserId === fromUserId,
      );
      return c.json({ success: true });
    } catch (error) {
      const routeError = toFollowRouteError(error, "Takip istegi reddedilemedi.");
      if (routeError.status >= 500) {
        logError("follows/requests/reject", "follow-request-reject-failed", error, {
          userId: user.id,
        });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });
}
