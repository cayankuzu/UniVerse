import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { AuthUserData, UserProfile } from "../../../data/contracts/entities";
import type { AccountType } from "../../../data/contracts/api";

export type { AlbumPhotoWithMeta, AuthUserData, EventWithMeta, UserProfile, AccountType };

export type ProfileTileItem = AlbumPhotoWithMeta | EventWithMeta;
