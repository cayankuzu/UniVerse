import { useMemo } from "react";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { UserProfile } from "../../../data/contracts/entities";
import type { RelationSnapshot } from "../../../data/policies/visibility.shared";
import {
  createBlockedProfileSet,
  filterBlockedProfileAlbums,
  filterBlockedProfileEvents,
  filterClubAlbumsByOwner,
  hydrateProfileOwnedAlbums,
  hydrateEventsWithAlbumCounts,
  sanitizeProfileAlbums,
  sanitizeProfileEvents,
  sortProfileAlbums,
  sortProfileEvents,
} from "./profileCollections";
import type { AlbumOwnerFilter, ProfileTab } from "../domain/profileConstants";
import { normalizeProfileValue } from "../domain/viewProfile.helpers";
import { resolveProfileTabState } from "../domain/viewProfileState.helpers";
import {
  buildProfileTabs,
  getProfileEmptyText,
  resolveProfileTileData,
} from "./profileCollectionsPresentation";
import { useStableProfileAlbums } from "./useStableProfileAlbums";

interface UseProfileCollectionsStateParams {
  albumOwnerFilter: AlbumOwnerFilter;
  blockedUsers: string[];
  blockedSet?: Set<string>;
  buildRelationByClub: (usernames: string[]) => Record<string, RelationSnapshot>;
  profile: UserProfile | null | undefined;
  profileOwnerId?: string;
  projectionFetching: boolean;
  refreshing: boolean;
  sourceAlbums: AlbumPhotoWithMeta[];
  sourceEvents: EventWithMeta[];
  tab: ProfileTab;
  username: string;
  viewerUsername?: string;
}

export function useProfileCollectionsState({
  albumOwnerFilter,
  blockedUsers,
  blockedSet: providedBlockedSet,
  buildRelationByClub,
  profile,
  profileOwnerId,
  projectionFetching,
  refreshing,
  sourceAlbums,
  sourceEvents,
  tab,
  username,
  viewerUsername,
}: UseProfileCollectionsStateParams) {
  const blockedSet = useMemo(
    () => providedBlockedSet || createBlockedProfileSet(blockedUsers || []),
    [blockedUsers, providedBlockedSet],
  );
  const isOwnProfile = useMemo(
    () =>
      normalizeProfileValue(profile?.username || username) ===
      normalizeProfileValue(viewerUsername || ""),
    [profile?.username, username, viewerUsername],
  );
  const resolvedOwnerId = useMemo(
    () => String(profile?.id || profileOwnerId || "").trim(),
    [profile?.id, profileOwnerId],
  );
  const allAlbums = useMemo(() => {
    const sanitizedAlbums = sanitizeProfileAlbums(sourceAlbums || []);
    const hydratedAlbums = hydrateProfileOwnedAlbums(
      sanitizedAlbums,
      profile,
      username,
      resolvedOwnerId,
    );
    return sortProfileAlbums(
      filterBlockedProfileAlbums(hydratedAlbums, blockedSet, {
        isOwnProfile,
        ownerUserId: resolvedOwnerId,
        ownerUsername: username,
        profile,
      }),
    );
  }, [blockedSet, isOwnProfile, profile, resolvedOwnerId, sourceAlbums, username]);
  const stableAllAlbums = useStableProfileAlbums(allAlbums, refreshing || projectionFetching);
  const events = useMemo(
    () =>
      hydrateEventsWithAlbumCounts(
        sortProfileEvents(
          filterBlockedProfileEvents(sanitizeProfileEvents(sourceEvents || []), blockedSet),
        ),
        stableAllAlbums,
      ),
    [blockedSet, sourceEvents, stableAllAlbums],
  );

  const isClub = profile?.accountType === "club";
  const albums = useMemo(
    () =>
      isClub
        ? filterClubAlbumsByOwner(
            stableAllAlbums,
            albumOwnerFilter,
            normalizeProfileValue(profile?.username || username),
            resolvedOwnerId,
          )
        : stableAllAlbums,
    [albumOwnerFilter, isClub, profile?.username, resolvedOwnerId, stableAllAlbums, username],
  );

  const { tabCounts } = useMemo(
    () =>
      resolveProfileTabState({
        albumsLength: stableAllAlbums.length,
        eventsLength: events.length,
        profile,
      }),
    [events.length, profile, stableAllAlbums.length],
  );
  const tabs = useMemo(
    () =>
      buildProfileTabs({
        accountType: isClub ? "club" : "student",
        albumsCount: tabCounts.albums,
        eventsCount: tabCounts.events,
      }),
    [isClub, tabCounts.albums, tabCounts.events],
  );
  const tileData = useMemo(
    () => resolveProfileTileData({ tab, albums, events }),
    [albums, events, tab],
  );
  const albumRelationByClub = useMemo(
    () =>
      buildRelationByClub(
        Array.from(
          new Set(
            albums
              .map((item: { clubUsername?: string | null }) =>
                normalizeProfileValue(item.clubUsername || ""),
              )
              .filter(Boolean),
          ),
        ),
      ),
    [albums, buildRelationByClub],
  );
  const eventRelationByClub = useMemo(
    () =>
      buildRelationByClub(
        Array.from(
          new Set(
            events.map((item) => normalizeProfileValue(item.clubUsername || "")).filter(Boolean),
          ),
        ),
      ),
    [buildRelationByClub, events],
  );

  return {
    albumRelationByClub,
    albums,
    emptyText: getProfileEmptyText(tab, isClub ? "club" : "student"),
    eventRelationByClub,
    events,
    isClub,
    tabs,
    tileData,
  };
}
