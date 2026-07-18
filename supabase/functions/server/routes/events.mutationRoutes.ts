import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import { removeEventFromKv, sweepNotificationsByTarget } from "./contentCleanup.ts";
import type {
  KvBooleanRecord,
  KvCommentRecord,
  KvEventRecord,
  KvFollowRecord,
  ServerRouteDeps,
} from "../types.ts";
import { enforceCompatMutationRateLimit } from "./compatMutationRateLimit.ts";
import { parseEventCreateBody, parseEventParams } from "./compatRouteValidation.ts";
import type { EventRouteApp, EventRouteContextFactory } from "./eventsRouteHelpers.ts";
import {
  normalizeEventCreateErrorMessage,
  resolveEventAttendanceScope,
  resolveEventVisibilityFromAccess,
  toIsoDateTime,
  toNonEmptyText,
  toRouteError,
  toTextArray,
} from "./eventsRouteHelpers.ts";
import { isSqlBlockedPair } from "../services/sqlBlockedState.ts";

const EVENT_TOGGLE_WINDOW_MS = 60_000;
const EVENT_TOGGLE_USER_LIMIT = 60;
const EVENT_TOGGLE_IP_LIMIT = 120;
const EVENT_WRITE_WINDOW_MS = 10 * 60_000;
const EVENT_WRITE_USER_LIMIT = 6;
const EVENT_WRITE_IP_LIMIT = 12;

type EventMutationRouteDeps = Pick<
  ServerRouteDeps,
  "addNotification" | "adminSupabase" | "generateId" | "getUser" | "loadCanonicalProfile"
>;

export function registerEventMutationRoutes(
  app: EventRouteApp,
  deps: EventMutationRouteDeps,
  createEventRequestContext: EventRouteContextFactory,
) {
  const { addNotification, adminSupabase, generateId, getUser, loadCanonicalProfile } = deps;

  app.post("/make-server-e3557d40/events", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: EVENT_WRITE_IP_LIMIT,
      scope: "compat:events:create",
      userId: user.id,
      userLimit: EVENT_WRITE_USER_LIMIT,
      windowMs: EVENT_WRITE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const body = parseEventCreateBody(await c.req.json().catch(() => ({})));
      const profile = await loadCanonicalProfile(user);
      if (!profile) return c.json({ error: "Profile not found" }, 404);
      if (profile.accountType !== "club")
        return c.json({ error: "Only clubs can create events" }, 403);

      const eventId = generateId();
      const createdAt = new Date().toISOString();
      const startsAt = toIsoDateTime(
        body.startDate || body.date,
        body.startTime || "10:00",
        "10:00",
      );
      const endsAt = toIsoDateTime(
        body.endDate || body.startDate || body.date,
        body.endTime || body.startTime || "12:00",
        "12:00",
      );

      const eventInsert = {
        access_label: toNonEmptyText(body.access, "Herkese acik"),
        id: eventId,
        address: toNonEmptyText(body.address),
        capacity: Number.isFinite(Number(body.capacity)) ? Number(body.capacity) : null,
        categories: toTextArray(body.categories),
        category: toNonEmptyText(body.category, "Genel"),
        club_id: user.id,
        cover_image_path: toNonEmptyText(body.image),
        description: toNonEmptyText(body.description),
        ends_at: endsAt,
        event_type: toNonEmptyText(body.type, "Genel"),
        fee_label: toNonEmptyText(body.fee, "Ucretsiz"),
        level: toNonEmptyText(body.level),
        location_name: toNonEmptyText(body.location, body.address, "Konum belirtilmedi"),
        materials: toNonEmptyText(body.materials),
        starts_at: startsAt,
        target_audience: toNonEmptyText(body.targetAudience),
        title: toNonEmptyText(body.title, "Etkinlik"),
        updated_by: user.id,
        visibility: resolveEventVisibilityFromAccess(body.access),
      };

      const { error: insertError } = await adminSupabase
        .from("events")
        .insert(eventInsert)
        .select("id")
        .single();
      if (insertError) {
        logError("events/create", "event-create-insert-failed", insertError, { userId: user.id });
        return c.json({ error: normalizeEventCreateErrorMessage(insertError) }, 400);
      }

      const event: KvEventRecord = {
        ...body,
        id: eventId,
        clubUserId: user.id,
        clubUsername: profile.username,
        club: profile.clubName || profile.name || profile.username,
        clubImage: profile.profileImage || "",
        university: profile.university,
        date: body.startDate || body.date || startsAt.slice(0, 10),
        createdAt,
        image: toNonEmptyText(body.image),
        visibility: resolveEventVisibilityFromAccess(body.access),
      };

      await kv.set(`event:${eventId}`, event);
      await kv.set<KvBooleanRecord>(`eventlikes:${eventId}`, {});
      await kv.set<string[]>(`eventattendees:${eventId}`, []);
      await kv.set<KvCommentRecord[]>(`eventcomments:${eventId}`, []);

      const clubEvents = await kv
        .get<string[]>(`clubevents:${profile.username}`)
        .then((value) => value || []);
      clubEvents.unshift(eventId);
      await kv.set(`clubevents:${profile.username}`, clubEvents);

      const allEvents = await kv.get<string[]>("all_events").then((value) => value || []);
      allEvents.unshift(eventId);
      await kv.set("all_events", allEvents);

      return c.json({ ...event, likes: 0, liked: false, attendees: 0, joined: false });
    } catch (error) {
      const routeError = toRouteError(error, "Etkinlik olusturulamadi.");
      if (routeError.status >= 500) {
        logError("events/create", "event-create-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/events/:id/like", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: EVENT_TOGGLE_IP_LIMIT,
      scope: "compat:events:like",
      userId: user.id,
      userLimit: EVENT_TOGGLE_USER_LIMIT,
      windowMs: EVENT_TOGGLE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { id } = parseEventParams({
        id: c.req.param("id"),
      });
      const event = await kv.get<KvEventRecord>(`event:${id}`);
      if (!event) return c.json({ error: "Event not found" }, 404);
      if (await isSqlBlockedPair(adminSupabase, user.id, String(event.clubUserId || ""))) {
        return c.json({ error: "Bu etkinlikle etkilesim kuramazsiniz." }, 403);
      }
      const likes = await kv.get<KvBooleanRecord>(`eventlikes:${id}`).then((value) => value || {});
      const wasLiked = Boolean(likes[user.id]);

      if (wasLiked) {
        delete likes[user.id];
      } else {
        likes[user.id] = true;
        const [profile] = await Promise.all([loadCanonicalProfile(user)]);
        if (event && event.clubUserId !== user.id) {
          await addNotification(String(event.clubUserId), {
            type: "like",
            fromUserId: user.id,
            fromUsername: profile?.username || "",
            fromName: profile?.name || profile?.clubName || "",
            fromImage: profile?.profileImage || "",
            message: "etkinliginizi begendi",
            eventTitle: event.title,
            eventId: id,
            targetType: "event",
          });
        }
      }

      await kv.set(`eventlikes:${id}`, likes);
      return c.json({ liked: !wasLiked, count: Object.values(likes).filter(Boolean).length });
    } catch (error) {
      const routeError = toRouteError(error, "Begeni guncellenemedi.");
      if (routeError.status >= 500) {
        logError("events/like", "event-like-toggle-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/events/:id/attend", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: EVENT_TOGGLE_IP_LIMIT,
      scope: "compat:events:attend",
      userId: user.id,
      userLimit: EVENT_TOGGLE_USER_LIMIT,
      windowMs: EVENT_TOGGLE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { id } = parseEventParams({
        id: c.req.param("id"),
      });
      const viewerProfile = await loadCanonicalProfile(user);
      if (viewerProfile?.accountType === "club") {
        return c.json({ error: "Club accounts cannot join events" }, 403);
      }

      const event = await kv.get<KvEventRecord>(`event:${id}`);
      if (!event) return c.json({ error: "Event not found" }, 404);
      if (await isSqlBlockedPair(adminSupabase, user.id, String(event.clubUserId || ""))) {
        return c.json({ error: "Bu etkinlikle etkilesim kuramazsiniz." }, 403);
      }

      const attendees = await kv.get<string[]>(`eventattendees:${id}`).then((value) => value || []);
      const wasJoined = attendees.includes(user.id);
      const attendanceScope = resolveEventAttendanceScope(event.access || "");

      if (!wasJoined && attendanceScope === "university_only") {
        const viewerUniversity = String(viewerProfile?.university || "")
          .trim()
          .toLowerCase();
        const eventUniversity = String(event.university || "")
          .trim()
          .toLowerCase();
        if (!viewerUniversity || !eventUniversity || viewerUniversity !== eventUniversity) {
          return c.json(
            { error: "Bu etkinlige sadece kulubun universitesindeki kullanicilar katilabilir." },
            403,
          );
        }
      }

      if (!wasJoined && attendanceScope === "followers_only") {
        const followingRows = await kv
          .get<KvFollowRecord[]>(`following:${user.id}`)
          .then((value) => value || []);
        const followsClub = followingRows.some(
          (item) => String(item.userId || "") === String(event.clubUserId || ""),
        );
        if (!followsClub) {
          return c.json(
            { error: "Bu etkinlige katilmak icin once kulubu takip etmelisiniz." },
            403,
          );
        }
      }

      let nextAttendees: string[];
      if (wasJoined) {
        nextAttendees = attendees.filter((attendeeId) => attendeeId !== user.id);
      } else {
        nextAttendees = [...attendees, user.id];
        if (event.clubUserId && event.clubUserId !== user.id) {
          await addNotification(String(event.clubUserId), {
            type: "join",
            fromUserId: user.id,
            fromUsername: viewerProfile?.username || "",
            fromName: viewerProfile?.name || viewerProfile?.clubName || "",
            fromImage: viewerProfile?.profileImage || "",
            message: "etkinliginize katildi",
            eventTitle: event.title,
            eventId: id,
            targetType: "event",
          });
        }
      }

      await kv.set(`eventattendees:${id}`, nextAttendees);
      return c.json({ joined: !wasJoined, count: nextAttendees.length });
    } catch (error) {
      const routeError = toRouteError(error, "Katilim guncellenemedi.");
      if (routeError.status >= 500) {
        logError("events/attend", "event-attend-toggle-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.delete("/make-server-e3557d40/events/:id", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: EVENT_WRITE_IP_LIMIT,
      scope: "compat:events:delete",
      userId: user.id,
      userLimit: EVENT_WRITE_USER_LIMIT,
      windowMs: EVENT_WRITE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const routeContext = createEventRequestContext();
      const { id } = parseEventParams({
        id: c.req.param("id"),
      });
      const context = await routeContext.getDeleteEventContext(id);
      if (!context) return c.json({ error: "Event not found" }, 404);
      if (!routeContext.canModerateEvent(user.id, context.clubUserId)) {
        return c.json({ error: "Bu etkinligi silme yetkiniz yok." }, 403);
      }

      const { error } = await adminSupabase.from("events").delete().eq("id", id);
      if (
        error &&
        !String(error.message || "")
          .toLowerCase()
          .includes("no rows")
      ) {
        logError("events/delete", "event-delete-provider-failed", error, {
          userId: user.id,
          eventId: id,
        });
        return c.json({ error: "Etkinlik silinemedi." }, 500);
      }

      await removeEventFromKv(id, context.clubUsername);
      await sweepNotificationsByTarget({ eventId: id });
      return c.json({ success: true });
    } catch (error) {
      const routeError = toRouteError(error, "Etkinlik silinemedi.");
      if (routeError.status >= 500) {
        logError("events/delete", "event-delete-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });
}
