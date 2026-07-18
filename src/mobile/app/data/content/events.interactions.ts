import type { ClientMutationOptions } from "../mutations/clientMutation";
import type { ProjectionRequestContext } from "../projections/projections.request";
import { ProjectionAPI } from "../projections/projections.shared";
import { ReportAPI } from "../normalizers/reports";
import { EventAPI } from "./events.api";

interface EventLikeMutationOptions extends ClientMutationOptions {
  desiredLiked?: boolean;
}

interface EventAttendanceMutationOptions extends ClientMutationOptions {
  desiredJoined?: boolean;
}

export function fetchEventComments(
  eventId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getEventComments(eventId, context, viewerId);
}

export function fetchEventLikers(
  eventId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getEventLikers(eventId, context, viewerId);
}

export function fetchEventAttendees(
  eventId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getEventAttendees(eventId, context, viewerId);
}

export function fetchEventCommentLikers(
  commentId: string,
  context: ProjectionRequestContext = {},
  viewerId?: string,
) {
  return ProjectionAPI.getEventCommentLikers(commentId, context, viewerId);
}

export function likeEvent(eventId: string, options?: EventLikeMutationOptions) {
  return EventAPI.like(eventId, options);
}

export function attendEvent(eventId: string, options?: EventAttendanceMutationOptions) {
  return EventAPI.attend(eventId, options);
}

export function toggleEventCommentLike(
  commentId: string,
  options?: { clientMutationId?: string | null; desiredLiked?: boolean | null },
) {
  return EventAPI.toggleCommentLike(commentId, options);
}

export function deleteEvent(eventId: string) {
  return EventAPI.deleteEvent(eventId);
}

export function deleteEventComment(eventId: string, commentId: string) {
  return EventAPI.deleteComment(eventId, commentId);
}

export function reportEvent(params: { eventId: string; reason: string }) {
  return ReportAPI.submit({
    reason: params.reason,
    targetId: params.eventId,
    targetType: "event",
  });
}

export function reportEventComment(params: { commentId: string; username: string }) {
  return ReportAPI.submit({
    reason: "Uygunsuz yorum",
    targetId: params.commentId,
    targetType: "event_comment",
    targetUsername: params.username,
  });
}
