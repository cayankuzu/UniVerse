import {
  mapAlbumProjectionRow,
  mergeAlbumCollections,
  mergeAlbumItem,
  normalizeAlbumProjectionItem,
  resolveAlbumSurfaceVisibility,
  type AlbumProjectionRpcRow,
} from "../../normalizers/albums";
import { normalizeAlbumVisibility } from "../../policies/visibility";
import { supabase } from "../../../platform/supabase";
import type { AlbumListContext, AlbumPhotoWithMeta } from "./albums.types";
export {
  fetchClubProfilePhotosFromTable,
  fetchEventPhotosFromTable,
  fetchFeedPhotosFromTable,
  fetchJoinedProfilePhotosFromTable,
  fetchProfilePhotosFromTable,
} from "./albums.table";
export type {
  AlbumListContext,
  AlbumPhotoTableRow,
  AlbumPhotoWithMeta,
  UploadPhotoPayload,
} from "./albums.types";
export { mergeAlbumCollections };
export { normalizeAlbumProjectionItem };

type AlbumRpcRow = AlbumProjectionRpcRow;

type AlbumSurfaceFlagRow = {
  id: string;
  show_on_profile: boolean;
  show_on_user_profile?: boolean | null;
  show_on_club_profile?: boolean | null;
};

const mapAlbumRpcRow = mapAlbumProjectionRow;

export function normalizeAlbumLookupValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function hydrateAlbumSurfaceFlags<T extends AlbumPhotoWithMeta>(
  items: T[],
  options: {
    ids?: Iterable<string>;
  } = {},
): Promise<T[]> {
  const missingFlagIds = options.ids
    ? Array.from(
        new Set(
          Array.from(options.ids)
            .map((item) => String(item || "").trim())
            .filter(Boolean),
        ),
      )
    : Array.from(
        new Set(
          items
            .filter(
              (item) =>
                typeof item.showOnOwnProfile !== "boolean" ||
                typeof item.showOnClubProfile !== "boolean",
            )
            .map((item) => String(item.id || "").trim())
            .filter(Boolean),
        ),
      );

  if (!missingFlagIds.length) return items;

  const { data, error } = await supabase
    .from("album_photos")
    .select("id,show_on_profile,show_on_user_profile,show_on_club_profile")
    .in("id", missingFlagIds)
    .is("deleted_at", null);

  if (error || !Array.isArray(data) || data.length === 0) return items;

  const flagMap = new Map<string, AlbumSurfaceFlagRow>(
    data.map((row) => [
      String((row as AlbumSurfaceFlagRow).id || "").trim(),
      row as AlbumSurfaceFlagRow,
    ]),
  );

  return items.map((item) => {
    const flags = flagMap.get(String(item.id || "").trim());
    if (!flags) return item;
    const visibility = resolveAlbumSurfaceVisibility({
      showOnClubProfile: flags.show_on_club_profile ?? undefined,
      showOnOwnProfile: flags.show_on_user_profile ?? undefined,
      showOnProfile: Boolean(flags.show_on_profile),
    });
    return {
      ...item,
      showOnOwnProfile: visibility.showOnOwnProfile,
      showOnClubProfile: visibility.showOnClubProfile,
      showOnProfile: visibility.showOnProfile,
      surfaceVisibility: visibility,
    };
  }) as T[];
}

function isMembersOnlyAlbum(
  album: Pick<AlbumPhotoWithMeta, "eventVisibility" | "effectiveVisibility">,
) {
  return album.eventVisibility === "members_only" || album.effectiveVisibility === "members_only";
}

function isRestrictedAlbumCard(
  album: Pick<AlbumPhotoWithMeta, "eventVisibility" | "effectiveVisibility">,
) {
  return isMembersOnlyAlbum(album) || album.effectiveVisibility === "followers_only";
}

export function mergeSupplementalRestrictedAlbums(
  primary: AlbumPhotoWithMeta[],
  fallback: AlbumPhotoWithMeta[],
): AlbumPhotoWithMeta[] {
  const merged = new Map<string, AlbumPhotoWithMeta>();

  primary.forEach((item) => {
    if (!item?.id) return;
    merged.set(item.id, item);
  });

  fallback.forEach((item) => {
    if (!item?.id || !isRestrictedAlbumCard(item)) return;
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? mergeAlbumItem(existing, item) : item);
  });

  return Array.from(merged.values());
}

export async function listVisibleAlbums(
  context: AlbumListContext,
  targetProfileId?: string,
  targetEventIds?: string[],
): Promise<AlbumPhotoWithMeta[] | null> {
  const { data, error } = await supabase.rpc("list_visible_albums", {
    album_context: context,
    target_profile_id: targetProfileId || null,
    target_event_ids: targetEventIds && targetEventIds.length ? targetEventIds : null,
  });

  if (error || !Array.isArray(data)) return null;
  return hydrateAlbumSurfaceFlags(data.map((row) => mapAlbumRpcRow(row as AlbumRpcRow)));
}

export async function listProfileVisibleAlbums(
  targetProfileId?: string,
): Promise<AlbumPhotoWithMeta[] | null> {
  const { data, error } = await supabase.rpc("list_profile_visible_albums", {
    target_profile_id: targetProfileId || null,
  });

  if (error || !Array.isArray(data)) return null;
  return hydrateAlbumSurfaceFlags(data.map((row) => mapAlbumRpcRow(row as AlbumRpcRow)));
}

export async function resolveProfileAccountType(
  targetUserId: string | null,
): Promise<"student" | "club" | null> {
  if (!targetUserId) return null;
  const { data: profileRow, error } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (error) return null;
  return profileRow?.account_type === "club"
    ? "club"
    : profileRow?.account_type === "student"
      ? "student"
      : null;
}

export function matchesProfileAlbumSurface(
  item: AlbumPhotoWithMeta,
  accountType: "student" | "club" | null,
) {
  const visibility = resolveAlbumSurfaceVisibility(
    normalizeAlbumVisibility(item, { ownFallbackToProfile: true }),
  );
  if (accountType === "club") return visibility.showOnClubProfile;
  if (accountType === "student") return visibility.showOnOwnProfile;
  return true;
}
