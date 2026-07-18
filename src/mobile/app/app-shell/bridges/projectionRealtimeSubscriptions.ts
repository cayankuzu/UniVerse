import { applyProjectionRealtimeEvent } from "../../data/projections/projectionRealtime";
import { invalidateViewerBlockedVisibility } from "../../data/social/blockedVisibility";

type ProjectionRealtimePayload = {
  eventType: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

type ProjectionRealtimeChannel = {
  on: (
    event: "postgres_changes",
    config: {
      event: "*";
      filter?: string;
      schema: "public";
      table: string;
    },
    callback: (payload: ProjectionRealtimePayload) => void,
  ) => ProjectionRealtimeChannel;
};

export type ProjectionRealtimeDispatch = (
  event: Parameters<typeof applyProjectionRealtimeEvent>[0]["event"],
) => void;

function getPayloadEventId(payload: {
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}) {
  const candidate = payload.new?.event_id ?? payload.old?.event_id;
  return typeof candidate === "string" ? candidate : "";
}

function getPayloadString(
  payload: {
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  },
  key: string,
) {
  const candidate = payload.new?.[key] ?? payload.old?.[key];
  return typeof candidate === "string" ? candidate : "";
}

function getPayloadBoolean(
  payload: {
    new: Record<string, unknown> | null;
    old: Record<string, unknown> | null;
  },
  keys: string[],
) {
  for (const key of keys) {
    const candidate = payload.new?.[key] ?? payload.old?.[key];
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }
  return null;
}

export function bindNotificationRealtime(
  channel: ProjectionRealtimeChannel,
  params: {
    dispatch: ProjectionRealtimeDispatch;
    viewerId: string;
    viewerKey: string;
  },
) {
  const { dispatch, viewerId, viewerKey } = params;
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${viewerId}` },
    (payload) => {
      const isRead = getPayloadBoolean(
        {
          new: payload.new || null,
          old: payload.old || null,
        },
        ["is_read", "read"],
      );
      dispatch({
        kind: payload.eventType === "INSERT" ? "notifications-upsert" : "notifications-updated",
        unreadDelta: payload.eventType === "INSERT" && isRead === false ? 1 : 0,
        viewerKey,
      });
    },
  );
}

export function bindSocialRealtime(
  channel: ProjectionRealtimeChannel,
  params: {
    dispatch: ProjectionRealtimeDispatch;
    onBlockRelationChanged?: () => void;
    viewerId: string;
    viewerKey: string;
    viewerUsername: string;
  },
) {
  const { dispatch, onBlockRelationChanged, viewerId, viewerKey, viewerUsername } = params;
  const dispatchSocialEvent = (
    payload: ProjectionRealtimePayload,
    targetKey: "blocked_id" | "blocker_id" | "follower_id" | "following_id",
    isBlockChange = false,
  ) => {
    if (isBlockChange) {
      invalidateViewerBlockedVisibility(viewerId);
      onBlockRelationChanged?.();
    }
    dispatch({
      kind: "profile-social-changed",
      targetProfileIds: [
        getPayloadString(
          {
            new: payload.new || null,
            old: payload.old || null,
          },
          targetKey,
        ),
      ],
      viewerKey,
      viewerUsername,
    });
  };

  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${viewerId}` },
    (payload) => dispatchSocialEvent(payload, "following_id"),
  );
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${viewerId}` },
    (payload) => dispatchSocialEvent(payload, "follower_id"),
  );
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "blocks", filter: `blocker_id=eq.${viewerId}` },
    (payload) => dispatchSocialEvent(payload, "blocked_id", true),
  );
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "blocks", filter: `blocked_id=eq.${viewerId}` },
    (payload) => dispatchSocialEvent(payload, "blocker_id", true),
  );
}

export function bindContentRealtime(
  channel: ProjectionRealtimeChannel,
  params: {
    dispatch: ProjectionRealtimeDispatch;
    eventIds: string[];
    photoIds: string[];
    viewerKey: string;
  },
) {
  const { dispatch, eventIds, photoIds, viewerKey } = params;
  const dispatchEventContentChange = (payload: ProjectionRealtimePayload) => {
    const eventId = getPayloadEventId({
      new: payload.new || null,
      old: payload.old || null,
    });
    if (!eventId) return;
    dispatch({
      eventIds: [eventId],
      kind: "content-engagement-changed",
      viewerKey,
    });
  };

  const dispatchPhotoContentChange = (payload: ProjectionRealtimePayload) => {
    const photoId = getPayloadString(
      {
        new: payload.new || null,
        old: payload.old || null,
      },
      "photo_id",
    );
    if (!photoId) return;
    dispatch({
      kind: "content-engagement-changed",
      photoIds: [photoId],
      viewerKey,
    });
  };

  Array.from(new Set(eventIds.map((value) => String(value || "").trim()).filter(Boolean))).forEach(
    (eventId) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_comments", filter: `event_id=eq.${eventId}` },
        dispatchEventContentChange,
      );
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_attendees",
          filter: `event_id=eq.${eventId}`,
        },
        dispatchEventContentChange,
      );
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_likes", filter: `event_id=eq.${eventId}` },
        dispatchEventContentChange,
      );
    },
  );
  Array.from(new Set(photoIds.map((value) => String(value || "").trim()).filter(Boolean))).forEach(
    (photoId) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "album_photo_comments",
          filter: `photo_id=eq.${photoId}`,
        },
        dispatchPhotoContentChange,
      );
    },
  );
}
