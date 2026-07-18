import type { AttendResponse, LikeResponse } from "../contracts/api";
import { subscribeMutationAction } from "../queues/mutationActionQueue";
import {
  getAlbumLikePayload,
  getEventAttendancePayload,
  getEventLikePayload,
} from "./contentToggleQueue.shared";

export function subscribeToEventLikeToggleAction(
  entryId: string,
  params: {
    onFailed?: (details: {
      previousCount: number;
      previousLiked: boolean;
      rolledBackFromLiked: boolean;
    }) => void;
    onResolved?: (result: LikeResponse) => void;
  },
) {
  return subscribeMutationAction(entryId, (event) => {
    const payload = getEventLikePayload(event.entry);
    if (event.status === "resolved") {
      params.onResolved?.(event.result as LikeResponse);
      return;
    }
    params.onFailed?.({
      previousCount: payload.previousCount,
      previousLiked: payload.previousLiked,
      rolledBackFromLiked: payload.targetLiked,
    });
  });
}

export function subscribeToEventAttendanceToggleAction(
  entryId: string,
  params: {
    onFailed?: (details: {
      previousCount: number;
      previousJoined: boolean;
      rolledBackFromJoined: boolean;
    }) => void;
    onResolved?: (result: AttendResponse) => void;
  },
) {
  return subscribeMutationAction(entryId, (event) => {
    const payload = getEventAttendancePayload(event.entry);
    if (event.status === "resolved") {
      params.onResolved?.(event.result as AttendResponse);
      return;
    }
    params.onFailed?.({
      previousCount: payload.previousCount,
      previousJoined: payload.previousJoined,
      rolledBackFromJoined: payload.targetJoined,
    });
  });
}

export function subscribeToAlbumLikeToggleAction(
  entryId: string,
  params: {
    onFailed?: (details: {
      previousCount: number;
      previousLiked: boolean;
      rolledBackFromLiked: boolean;
    }) => void;
    onResolved?: (result: LikeResponse) => void;
  },
) {
  return subscribeMutationAction(entryId, (event) => {
    const payload = getAlbumLikePayload(event.entry);
    if (event.status === "resolved") {
      params.onResolved?.(event.result as LikeResponse);
      return;
    }
    params.onFailed?.({
      previousCount: payload.previousCount,
      previousLiked: payload.previousLiked,
      rolledBackFromLiked: payload.targetLiked,
    });
  });
}
