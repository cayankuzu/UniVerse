export type { AlbumListContext, AlbumPhotoWithMeta } from "../../contracts/content";

export interface UploadPhotoPayload {
  eventId: string;
  eventTitle: string;
  image?: string;
  images?: string[];
  mediaKinds?: Array<"image" | "video">;
  caption?: string;
  title?: string;
  showOnProfile?: boolean;
  showOnOwnProfile?: boolean;
  showOnClubProfile?: boolean;
  clientMutationId?: string;
}

export interface AlbumPhotoTableRow {
  id: string;
  event_id: string | null;
  user_id: string;
  storage_path: string | null;
  media_paths: string[] | null;
  caption: string | null;
  title: string | null;
  event_title_snapshot?: string | null;
  event_visibility_snapshot?: "public" | "members_only" | null;
  club_name_snapshot?: string | null;
  club_username_snapshot?: string | null;
  club_is_private_snapshot?: boolean | null;
  show_on_profile: boolean;
  show_on_user_profile?: boolean | null;
  show_on_club_profile?: boolean | null;
  created_at: string;
}
