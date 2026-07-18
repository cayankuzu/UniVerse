import type { ImageVariants } from "../normalizers/media";
import type { AlbumPhoto, Event } from "./entities";

export type EventWithMeta = Event & {
  comments?: number;
  clubIsPrivate?: boolean;
  effectiveVisibility?: "public" | "followers_only" | "members_only";
  canDiscoverEvent?: boolean;
  canOpenEventDetail?: boolean;
  canAttendEvent?: boolean;
  canViewAttendees?: boolean;
  canOpenEventAlbum?: boolean;
  canUploadEventAlbum?: boolean;
  isEndedOrLocked?: boolean;
  albumCount?: number;
  imageVariants?: ImageVariants;
  uploadStatus?: "failed" | "pending" | "uploading";
  uploadError?: string;
  lockedReasonCode?: string;
  lockedReasonText?: string;
  feedActorType?: "club" | "student";
  feedActorUsername?: string;
  feedSource?: "own" | "following_club" | "following_student";
};

export type AlbumListContext = "feed" | "search" | "profile" | "event_album";

export type AlbumPhotoWithMeta = AlbumPhoto & {
  userUniversity?: string;
  clubName?: string;
  effectiveVisibility?: "public" | "followers_only" | "members_only";
  clubUserId?: string;
  clubUsername?: string;
  clubIsPrivate?: boolean;
  uploaderIsPrivate?: boolean;
  viewerJoinedEvent?: boolean;
  canDiscoverAlbum?: boolean;
  canOpenAlbum?: boolean;
  canOpenAlbumEventDetail?: boolean;
  canInteractAlbum?: boolean;
  lockedReasonCode?: string;
  lockedReasonText?: string;
};
