import type { NotificationItem } from "../contracts/api";
import { supabase } from "../../platform/supabase";
import { toDisplayName } from "../profile/profileDisplay";
import { timeAgo } from "../../shared/utils/dateTime";
import { debugLog, debugWarn } from "../../platform/logging/logger";
import {
  collapseLatestFollowRequests,
  mergeNotifications,
  normalizeNotificationRow,
  normalizeRequestStatus,
} from "./notificationsApi.helpers";

type AnyRecord = Record<string, unknown>;
const BASE_NOTIFICATION_SELECT =
  "id,type,actor_id,message,detail,event_id,target_profile_id,is_read,created_at";
const WITH_PHOTO_NOTIFICATION_SELECT = `${BASE_NOTIFICATION_SELECT},photo_id`;
const WITH_REQUEST_NOTIFICATION_SELECT = `${WITH_PHOTO_NOTIFICATION_SELECT},request_status,request_resolved_at`;

export async function fetchNotificationsForViewer(userId: string) {
  const tableRows = await fetchNotificationsFromTable(userId);
  debugLog("NOTIFICATIONS", "sources", {
    function: 0,
    table: tableRows.length,
  });
  return mergeNotifications(tableRows, []);
}

export async function fetchNotificationByIdForViewer(userId: string, notificationId: string) {
  const id = String(notificationId || "").trim();
  if (!id) return null;
  const rows = await fetchNotificationRowsFromTable(userId, id);
  return rows[0] || null;
}

async function fetchNotificationsFromTable(userId: string): Promise<NotificationItem[]> {
  return fetchNotificationRowsFromTable(userId);
}

async function fetchNotificationRowsFromTable(
  userId: string,
  notificationId?: string,
): Promise<NotificationItem[]> {
  let rows: AnyRecord[] = [];
  let tableError: unknown = null;
  const normalizedNotificationId = String(notificationId || "").trim();

  if (normalizedNotificationId) {
    const withRequestResult = await supabase
      .from("notifications")
      .select(WITH_REQUEST_NOTIFICATION_SELECT)
      .eq("user_id", userId)
      .eq("id", normalizedNotificationId)
      .maybeSingle();

    if (withRequestResult.error) {
      tableError = withRequestResult.error;
      debugWarn("NOTIFICATIONS", "table-select-single-with-photo-failed", {
        code: withRequestResult.error.code,
        details: withRequestResult.error.details,
        message: withRequestResult.error.message,
        notificationId: normalizedNotificationId,
      });

      const fallbackResult = await supabase
        .from("notifications")
        .select(WITH_PHOTO_NOTIFICATION_SELECT)
        .eq("user_id", userId)
        .eq("id", normalizedNotificationId)
        .maybeSingle();

      if (fallbackResult.error) {
        tableError = fallbackResult.error;
        debugWarn("NOTIFICATIONS", "table-select-single-fallback-failed", {
          code: fallbackResult.error.code,
          details: fallbackResult.error.details,
          message: fallbackResult.error.message,
          notificationId: normalizedNotificationId,
        });
      } else if (fallbackResult.data) {
        rows = [fallbackResult.data as AnyRecord];
      }
    } else if (withRequestResult.data) {
      rows = [withRequestResult.data as AnyRecord];
    }
  } else {
    const withRequestResult = await supabase
      .from("notifications")
      .select(WITH_REQUEST_NOTIFICATION_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (withRequestResult.error) {
      tableError = withRequestResult.error;
      debugWarn("NOTIFICATIONS", "table-select-with-photo-failed", {
        code: withRequestResult.error.code,
        details: withRequestResult.error.details,
        message: withRequestResult.error.message,
      });

      const fallbackResult = await supabase
        .from("notifications")
        .select(WITH_PHOTO_NOTIFICATION_SELECT)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fallbackResult.error) {
        tableError = fallbackResult.error;
        debugWarn("NOTIFICATIONS", "table-select-fallback-failed", {
          code: fallbackResult.error.code,
          details: fallbackResult.error.details,
          message: fallbackResult.error.message,
        });
      } else {
        rows = (fallbackResult.data as AnyRecord[] | null) || [];
      }
    } else {
      rows = (withRequestResult.data as AnyRecord[] | null) || [];
    }
  }

  if (rows.length === 0) {
    if (tableError) debugLog("NOTIFICATIONS", "table-empty-with-error");
    return [];
  }

  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))),
  );
  const eventIds = Array.from(
    new Set(rows.map((row) => row.event_id).filter((id): id is string => Boolean(id))),
  );
  const photoIds = Array.from(
    new Set(rows.map((row) => row.photo_id).filter((id): id is string => Boolean(id))),
  );

  const [profilesRes, eventsRes, photosRes] = await Promise.all([
    actorIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id,username,name,club_name,profile_image_path")
          .in("user_id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length > 0
      ? supabase.from("events").select("id,title").in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    photoIds.length > 0
      ? supabase.from("album_photos").select("id,title,caption,event_id").in("id", photoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileMap = new Map((profilesRes.data || []).map((profile) => [profile.user_id, profile]));
  const eventMap = new Map((eventsRes.data || []).map((eventItem) => [eventItem.id, eventItem]));
  const photoMap = new Map((photosRes.data || []).map((photo) => [photo.id, photo]));

  return collapseLatestFollowRequests(
    rows
      .map((row) => {
        const actorId = String(row.actor_id || "").trim();
        const eventId = String(row.event_id || "").trim();
        const photoId = String(row.photo_id || "").trim();
        const actor = actorId ? profileMap.get(actorId) : null;
        const eventItem = eventId ? eventMap.get(eventId) : null;
        const photoItem = photoId ? photoMap.get(photoId) : null;
        const contentTitle = photoItem
          ? String(photoItem.title || photoItem.caption || eventItem?.title || "").trim() ||
            undefined
          : eventItem?.title
            ? String(eventItem.title).trim() || undefined
            : undefined;
        const contentSubtitle =
          photoItem && eventItem?.title && eventItem.title !== contentTitle
            ? String(eventItem.title).trim() || undefined
            : undefined;
        return normalizeNotificationRow({
          createdAt: row.created_at,
          contentSubtitle,
          contentTitle,
          detail: row.detail || undefined,
          eventId: eventId || undefined,
          eventTitle: eventItem?.title || undefined,
          fromImage: actor?.profile_image_path || "",
          fromName: actor ? toDisplayName(actor) : "",
          fromUserId: actorId,
          fromUsername: actor?.username || "",
          id: row.id,
          message: row.message,
          photoId: photoId || undefined,
          read: row.is_read,
          requestResolvedAt: row.request_resolved_at ? String(row.request_resolved_at) : undefined,
          requestStatus: normalizeRequestStatus(row.request_status),
          targetType: row.target_profile_id
            ? "profile"
            : row.photo_id
              ? "album"
              : eventId
                ? "event"
                : "profile",
          time: timeAgo(String(row.created_at || "")),
          type: row.type,
        });
      })
      .filter((item): item is NotificationItem => Boolean(item)),
  );
}
