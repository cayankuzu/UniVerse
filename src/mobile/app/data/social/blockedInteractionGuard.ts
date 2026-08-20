import { supabase } from "../../platform/supabase";
import { loadViewerBlockedVisibility } from "./blockedVisibility";

const BLOCKED_INTERACTION_CACHE_TTL_MS = 30_000;

type CachedEntry<T> = {
  expiresAt: number;
  value: T;
};

type EventOwnership = {
  clubId: string;
};

type AlbumOwnership = {
  clubId: string;
  uploaderId: string;
};

type EventCommentContext = {
  authorId: string;
  clubId: string;
  eventId: string;
};

type AlbumCommentContext = {
  authorId: string;
  clubId: string;
  photoId: string;
  uploaderId: string;
};

const eventOwnershipCache = new Map<string, CachedEntry<EventOwnership>>();
const albumOwnershipCache = new Map<string, CachedEntry<AlbumOwnership>>();
const eventCommentContextCache = new Map<string, CachedEntry<EventCommentContext>>();
const albumCommentContextCache = new Map<string, CachedEntry<AlbumCommentContext>>();

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function readCachedValue<T>(cache: Map<string, CachedEntry<T>>, key: string) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCachedValue<T>(cache: Map<string, CachedEntry<T>>, key: string, value: T) {
  cache.set(key, {
    expiresAt: Date.now() + BLOCKED_INTERACTION_CACHE_TTL_MS,
    value,
  });
  return value;
}

export class BlockedInteractionError extends Error {
  constructor(message = "Engellenen etkileşime izin verilmiyor.") {
    super(message);
    this.name = "BlockedInteractionError";
  }
}

async function readViewerId(viewerIdHint?: string | null) {
  const viewerId = normalizeId(viewerIdHint);
  if (viewerId) return viewerId;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return normalizeId(user?.id);
}

async function assertViewerCanReachActor(
  viewerId: string,
  actorId: string,
  message = "Engellenen etkileşime izin verilmiyor.",
) {
  const normalizedViewerId = normalizeId(viewerId);
  const normalizedActorId = normalizeId(actorId);
  if (!normalizedViewerId || !normalizedActorId || normalizedViewerId === normalizedActorId) {
    return normalizedViewerId;
  }
  const blockedVisibility = await loadViewerBlockedVisibility(normalizedViewerId);
  if (blockedVisibility.blockedIds.has(normalizedActorId)) {
    throw new BlockedInteractionError(message);
  }
  return normalizedViewerId;
}

async function readEventOwnership(eventId: string) {
  const normalizedEventId = normalizeId(eventId);
  if (!normalizedEventId) return null;
  const cached = readCachedValue(eventOwnershipCache, normalizedEventId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from("events")
    .select("club_id")
    .eq("id", normalizedEventId)
    .maybeSingle();

  if (error || !data?.club_id) return null;
  return writeCachedValue(eventOwnershipCache, normalizedEventId, {
    clubId: normalizeId(data.club_id),
  });
}

async function readAlbumOwnership(photoId: string) {
  const normalizedPhotoId = normalizeId(photoId);
  if (!normalizedPhotoId) return null;
  const cached = readCachedValue(albumOwnershipCache, normalizedPhotoId);
  if (cached) return cached;

  const { data: photoRow, error: photoError } = await supabase
    .from("album_photos")
    .select("event_id,user_id")
    .eq("id", normalizedPhotoId)
    .maybeSingle();

  if (photoError || !photoRow?.user_id) return null;
  const eventId = normalizeId(photoRow.event_id);
  let clubId = "";

  if (eventId) {
    const eventOwnership = await readEventOwnership(eventId);
    clubId = normalizeId(eventOwnership?.clubId);
  }

  return writeCachedValue(albumOwnershipCache, normalizedPhotoId, {
    clubId,
    uploaderId: normalizeId(photoRow.user_id),
  });
}

async function readEventCommentContext(commentId: string) {
  const normalizedCommentId = normalizeId(commentId);
  if (!normalizedCommentId) return null;
  const cached = readCachedValue(eventCommentContextCache, normalizedCommentId);
  if (cached) return cached;

  const { data: commentRow, error: commentError } = await supabase
    .from("event_comments")
    .select("event_id,user_id")
    .eq("id", normalizedCommentId)
    .maybeSingle();

  if (commentError || !commentRow?.event_id || !commentRow?.user_id) return null;
  const eventId = normalizeId(commentRow.event_id);
  const eventOwnership = await readEventOwnership(eventId);
  if (!eventOwnership?.clubId) return null;

  return writeCachedValue(eventCommentContextCache, normalizedCommentId, {
    authorId: normalizeId(commentRow.user_id),
    clubId: normalizeId(eventOwnership.clubId),
    eventId,
  });
}

async function readAlbumCommentContext(commentId: string) {
  const normalizedCommentId = normalizeId(commentId);
  if (!normalizedCommentId) return null;
  const cached = readCachedValue(albumCommentContextCache, normalizedCommentId);
  if (cached) return cached;

  const { data: commentRow, error: commentError } = await supabase
    .from("album_photo_comments")
    .select("photo_id,user_id")
    .eq("id", normalizedCommentId)
    .maybeSingle();

  if (commentError || !commentRow?.photo_id || !commentRow?.user_id) return null;
  const photoId = normalizeId(commentRow.photo_id);
  const albumOwnership = await readAlbumOwnership(photoId);
  if (!albumOwnership?.uploaderId) return null;

  return writeCachedValue(albumCommentContextCache, normalizedCommentId, {
    authorId: normalizeId(commentRow.user_id),
    clubId: normalizeId(albumOwnership.clubId),
    photoId,
    uploaderId: normalizeId(albumOwnership.uploaderId),
  });
}

export async function assertEventInteractionAllowed(params: {
  eventId: string;
  viewerIdHint?: string | null;
}) {
  const viewerId = await readViewerId(params.viewerIdHint);
  if (!viewerId) throw new Error("Unauthorized");
  const ownership = await readEventOwnership(params.eventId);
  if (!ownership?.clubId) return viewerId;
  await assertViewerCanReachActor(
    viewerId,
    ownership.clubId,
    "Engellenen etkileşime izin verilmiyor. Bu etkinlik kullanılamıyor.",
  );
  return viewerId;
}

export async function assertAlbumInteractionAllowed(params: {
  photoId: string;
  viewerIdHint?: string | null;
}) {
  const viewerId = await readViewerId(params.viewerIdHint);
  if (!viewerId) throw new Error("Unauthorized");
  const ownership = await readAlbumOwnership(params.photoId);
  if (!ownership) return viewerId;
  await assertViewerCanReachActor(
    viewerId,
    ownership.uploaderId,
    "Engellenen etkileşime izin verilmiyor. Bu albüm kullanılamıyor.",
  );
  await assertViewerCanReachActor(
    viewerId,
    ownership.clubId,
    "Engellenen etkileşime izin verilmiyor. Bu albüm kullanılamıyor.",
  );
  return viewerId;
}

export async function assertEventCommentCreateAllowed(params: {
  eventId: string;
  parentId?: string | null;
  viewerIdHint?: string | null;
}) {
  const viewerId = await assertEventInteractionAllowed({
    eventId: params.eventId,
    viewerIdHint: params.viewerIdHint,
  });
  const parentId = normalizeId(params.parentId);
  if (!parentId) return viewerId;

  const parentComment = await readEventCommentContext(parentId);
  if (!parentComment) return viewerId;
  if (parentComment.eventId !== normalizeId(params.eventId)) return viewerId;
  await assertViewerCanReachActor(
    viewerId,
    parentComment.authorId,
    "Engellenen etkileşime izin verilmiyor. Bu yorum kullanılamıyor.",
  );
  return viewerId;
}

export async function assertAlbumCommentCreateAllowed(params: {
  parentId?: string | null;
  photoId: string;
  viewerIdHint?: string | null;
}) {
  const viewerId = await assertAlbumInteractionAllowed({
    photoId: params.photoId,
    viewerIdHint: params.viewerIdHint,
  });
  const parentId = normalizeId(params.parentId);
  if (!parentId) return viewerId;

  const parentComment = await readAlbumCommentContext(parentId);
  if (!parentComment) return viewerId;
  if (parentComment.photoId !== normalizeId(params.photoId)) return viewerId;
  await assertViewerCanReachActor(
    viewerId,
    parentComment.authorId,
    "Blocked interaction forbidden. This comment is unavailable.",
  );
  return viewerId;
}

export async function assertEventCommentLikeAllowed(params: {
  commentId: string;
  viewerIdHint?: string | null;
}) {
  const viewerId = await readViewerId(params.viewerIdHint);
  if (!viewerId) throw new Error("Unauthorized");
  const commentContext = await readEventCommentContext(params.commentId);
  if (!commentContext) return viewerId;
  await assertViewerCanReachActor(
    viewerId,
    commentContext.authorId,
    "Blocked interaction forbidden. This comment is unavailable.",
  );
  await assertViewerCanReachActor(
    viewerId,
    commentContext.clubId,
    "Blocked interaction forbidden. This comment is unavailable.",
  );
  return viewerId;
}

export async function assertAlbumCommentLikeAllowed(params: {
  commentId: string;
  viewerIdHint?: string | null;
}) {
  const viewerId = await readViewerId(params.viewerIdHint);
  if (!viewerId) throw new Error("Unauthorized");
  const commentContext = await readAlbumCommentContext(params.commentId);
  if (!commentContext) return viewerId;
  await assertViewerCanReachActor(
    viewerId,
    commentContext.authorId,
    "Blocked interaction forbidden. This comment is unavailable.",
  );
  await assertViewerCanReachActor(
    viewerId,
    commentContext.uploaderId,
    "Blocked interaction forbidden. This comment is unavailable.",
  );
  await assertViewerCanReachActor(
    viewerId,
    commentContext.clubId,
    "Blocked interaction forbidden. This comment is unavailable.",
  );
  return viewerId;
}
