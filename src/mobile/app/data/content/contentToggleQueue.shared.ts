import type { QueryClient } from "@tanstack/react-query";
import type { AttendResponse, LikeResponse } from "../contracts/api";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";
import type { MutationActionQueueEntry } from "../queues/mutationActionQueue";
import { patchAlbumMutationCaches } from "./albumMutationCache";
import { patchEventMutationCaches } from "./eventMutationCache";

// --- Types ---

export type EventLikeTogglePayload = {
  clientMutationId?: string | null;
  eventId: string;
  previousCount: number;
  previousLiked: boolean;
  targetLiked: boolean;
};

export type EventAttendanceTogglePayload = {
  clientMutationId?: string | null;
  eventId: string;
  previousCount: number;
  previousJoined: boolean;
  targetJoined: boolean;
};

export type AlbumLikeTogglePayload = {
  clientMutationId?: string | null;
  eventId?: string;
  photoId: string;
  previousCount: number;
  previousLiked: boolean;
  targetLiked: boolean;
};

// --- Payload extractors ---

export function getEventLikePayload(entry: MutationActionQueueEntry) {
  return entry.payload as unknown as EventLikeTogglePayload;
}

export function getEventAttendancePayload(entry: MutationActionQueueEntry) {
  return entry.payload as unknown as EventAttendanceTogglePayload;
}

export function getAlbumLikePayload(entry: MutationActionQueueEntry) {
  return entry.payload as unknown as AlbumLikeTogglePayload;
}

// --- Queue entry ID builders ---

export function buildEventLikeQueueEntryId(eventId: string) {
  return `event-like:${String(eventId || "").trim()}`;
}

export function buildEventAttendanceQueueEntryId(eventId: string) {
  return `event-attendance:${String(eventId || "").trim()}`;
}

export function buildAlbumLikeQueueEntryId(photoId: string) {
  return `album-like:${String(photoId || "").trim()}`;
}

// --- Cache patchers ---

export function patchResolvedEventLikeCache(
  queryClient: QueryClient,
  payload: EventLikeTogglePayload,
  result: LikeResponse,
) {
  patchEventMutationCaches<EventWithMeta>({
    eventId: payload.eventId,
    patch: {
      liked: result.liked,
      likes: result.count,
    },
    queryClient,
  });
}

export function patchResolvedEventAttendanceCache(
  queryClient: QueryClient,
  payload: EventAttendanceTogglePayload,
  result: AttendResponse,
) {
  patchEventMutationCaches<EventWithMeta>({
    eventId: payload.eventId,
    patch: {
      attendees: result.count,
      joined: result.joined,
    },
    queryClient,
  });
}

export function patchResolvedAlbumLikeCache(
  queryClient: QueryClient,
  payload: AlbumLikeTogglePayload,
  result: LikeResponse,
) {
  patchAlbumMutationCaches<AlbumPhotoWithMeta>({
    eventId: payload.eventId,
    patch: {
      liked: result.liked,
      likes: result.count,
    },
    photoId: payload.photoId,
    queryClient,
  });
}
