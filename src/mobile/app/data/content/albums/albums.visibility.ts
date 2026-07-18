import { fetchClubVisibilitySnapshot } from "./clubVisibilitySnapshot";
import { canViewAlbum, type RelationSnapshot } from "../../policies/visibility";
import { debugWarn } from "../../../platform/logging/logger";
import { supabase } from "../../../platform/supabase";
import { normalizeAlbumLookupValue, type AlbumPhotoWithMeta } from "./albums.shared";
import {
  filterAlbumsBySurfaceContext,
  filterEventAlbumSurfaceForViewer,
} from "../../normalizers/albums";
import { hydrateAlbumOwnerProfiles } from "./albums.owner";

async function resolveViewerIdentity() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const viewerId = String(user?.id || "").trim();
    if (!viewerId) return { viewerId: "", viewerUsername: "" };
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", viewerId)
      .maybeSingle();
    return {
      viewerId,
      viewerUsername: normalizeAlbumLookupValue(String(profile?.username || "")),
    };
  } catch (error) {
    debugWarn("CONTENT/ALBUMS", "album-visibility-viewer-resolve-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "album-visibility-viewer-resolve-failed",
      ),
    });
    return { viewerId: "", viewerUsername: "" };
  }
}

async function resolveViewerFollowingUsernames(viewerId: string) {
  if (!viewerId) return [] as string[];
  try {
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId)
      .eq("status", "accepted")
      .is("deleted_at", null);
    const followingIds = (followRows || [])
      .map((row) => String((row as { following_id?: string }).following_id || "").trim())
      .filter(Boolean);
    if (!followingIds.length) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id,username")
      .in("user_id", followingIds)
      .is("deleted_at", null);
    return (profiles || [])
      .map((row) =>
        normalizeAlbumLookupValue(String((row as { username?: string }).username || "")),
      )
      .filter(Boolean);
  } catch (error) {
    debugWarn("CONTENT/ALBUMS", "album-visibility-following-resolve-failed", {
      message: String(
        (error as { message?: string } | null)?.message ||
          "album-visibility-following-resolve-failed",
      ),
      viewerId,
    });
    return [];
  }
}

export async function finalizeAlbumResult(
  items: AlbumPhotoWithMeta[],
  context: "feed" | "search" | "profile" | "event_album",
) {
  if (!items.length) return items;
  const { viewerId, viewerUsername } = await resolveViewerIdentity();
  const surfaceFiltered =
    context === "event_album"
      ? filterEventAlbumSurfaceForViewer(items, { viewerId, viewerUsername })
      : filterAlbumsBySurfaceContext(items, context);
  if (!surfaceFiltered.length) return [];
  if (context === "search") {
    return surfaceFiltered;
  }
  const hydrated = await hydrateAlbumOwnerProfiles(surfaceFiltered);
  if (context === "profile") {
    return hydrated;
  }
  const viewerFollowingUsernames = await resolveViewerFollowingUsernames(viewerId);
  const clubUsernames = Array.from(
    new Set(
      hydrated.map((item) => normalizeAlbumLookupValue(item.clubUsername || "")).filter(Boolean),
    ),
  );
  const eventIds = Array.from(
    new Set(hydrated.map((item) => String(item.eventId || "").trim()).filter(Boolean)),
  );
  const visibilitySnapshot = await fetchClubVisibilitySnapshot({
    clubUsernames,
    eventIds,
    viewerId: viewerId || undefined,
  });

  return hydrated.filter((item) => {
    const eventId = String(item.eventId || "").trim();
    const derivedClub = visibilitySnapshot.clubMetaByEventId?.[eventId];
    const clubUsername = normalizeAlbumLookupValue(
      item.clubUsername || derivedClub?.clubUsername || "",
    );
    const snapshot = clubUsername
      ? visibilitySnapshot.clubMetaByUsername?.[clubUsername] || derivedClub
      : derivedClub;
    const relations: RelationSnapshot =
      clubUsername && snapshot
        ? {
            clubIsPrivate: false,
            followsUploader: viewerFollowingUsernames.includes(
              normalizeAlbumLookupValue(item.username || ""),
            ),
            followingUsernames: snapshot.followsClub ? [clubUsername] : [],
          }
        : {
            clubIsPrivate: false,
            followsUploader: viewerFollowingUsernames.includes(
              normalizeAlbumLookupValue(item.username || ""),
            ),
            followingUsernames: viewerFollowingUsernames,
          };

    return canViewAlbum(
      viewerUsername,
      {
        ...item,
        clubIsPrivate: false,
        clubUsername: item.clubUsername || snapshot?.clubUsername,
      },
      context,
      relations,
    ).canView;
  });
}
