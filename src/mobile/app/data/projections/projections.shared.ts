import type { ProjectionRequestContext } from "./projections.request";
import {
  getAlbumCommentLikersProjection,
  getAlbumPhotoLikersProjection,
  getEventCommentLikersProjection,
  getEventLikersProjection,
  getEventAttendeesProjection,
} from "./projectionUsers";
import {
  getEventCommentsProjection,
  getAlbumCommentsProjection as getAlbumCommentsProjectionItems,
} from "./projectionComments";
import { getAlbumEventProjection, getEventDetailProjection } from "./projectionDetails";
import { getBlockedUsersProjection } from "./projectionBlockedUsers";
import type {
  AlbumEventProjectionItem,
  BlockedUserProjectionItem,
  EventDetailProjection,
} from "./projections.types";

export type {
  AlbumEventProjectionItem,
  AppWarmupBundle,
  BlockedUserProjectionItem,
  EventDetailProjection,
  HomeProjectionParams,
  NotificationBadgeProjection,
  ProfileContentTab,
  ProfileOverviewProjection,
  ProfileScreenProjectionItem,
  ProfileScreenProjectionResult,
  ProjectionHomeFeedItem,
  RelationshipProjectionItem,
  SearchProjectionItem,
  SearchProjectionParams,
} from "./projections.types";
export type { ProjectionRequestContext } from "./projections.request";

export const ProjectionAPI = {
  getEventDetail: (
    eventId: string,
    viewerId?: string,
    context: ProjectionRequestContext = {},
  ): Promise<import("../../data/query/contracts").ProjectionEnvelope<EventDetailProjection>> =>
    getEventDetailProjection({
      context,
      eventId,
      viewerId,
    }),
  getAlbumEvent: (
    eventId: string,
    context: ProjectionRequestContext = {},
    viewerId?: string,
  ): Promise<import("../../data/query/contracts").ProjectionEnvelope<AlbumEventProjectionItem>> =>
    getAlbumEventProjection({
      context,
      eventId,
      viewerId,
    }),
  getBlockedUsers: (
    context: ProjectionRequestContext = {},
    viewerId?: string,
  ): Promise<import("../../data/query/contracts").ProjectionEnvelope<BlockedUserProjectionItem>> =>
    getBlockedUsersProjection({
      context,
      viewerId,
    }),
  getEventComments: (eventId: string, context: ProjectionRequestContext = {}, viewerId?: string) =>
    getEventCommentsProjection({ context, eventId, viewerId }),
  getEventLikers: (eventId: string, context: ProjectionRequestContext = {}, viewerId?: string) =>
    getEventLikersProjection({ context, eventId, viewerId }),
  getEventAttendees: (eventId: string, context: ProjectionRequestContext = {}, viewerId?: string) =>
    getEventAttendeesProjection({ context, eventId, viewerId }),
  getAlbumComments: (photoId: string, context: ProjectionRequestContext = {}, viewerId?: string) =>
    getAlbumCommentsProjectionItems({ context, photoId, viewerId }),
  getEventCommentLikers: (
    commentId: string,
    context: ProjectionRequestContext = {},
    viewerId?: string,
  ) => getEventCommentLikersProjection({ commentId, context, viewerId }),
  getAlbumCommentLikers: (
    commentId: string,
    context: ProjectionRequestContext = {},
    viewerId?: string,
  ) => getAlbumCommentLikersProjection({ commentId, context, viewerId }),
  getAlbumPhotoLikers: (
    photoId: string,
    context: ProjectionRequestContext = {},
    viewerId?: string,
  ) => getAlbumPhotoLikersProjection({ context, photoId, viewerId }),
};
