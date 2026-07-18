import { memo } from "react";
import { TourAnchor } from "../../../../app-shell/onboarding";
import type { OverflowActionItem } from "../../../../shared/components/OverflowActionMenu";
import {
  DiscoveryAlbumGridCard,
  DiscoveryEventGridCard,
  DiscoveryUserGridCard,
} from "../../../../features/content-cards/public/cards";
import { buildPreparedAlbumVisibility } from "../../../content-cards/public/presentation";
import type {
  AlbumPhotoWithMeta,
  EventWithMeta,
} from "../../../../features/content-cards/public/types";
import { resolveProfileEventAccess } from "../../application/profileCardPresentation";
import { isClubOwnedAlbum } from "../../application/profileCollections";
import { normalizeProfileTileUser as normalizeProfileTileUserModel } from "../../application/profileTileUser";
import type { ProfileTab } from "../../domain";

interface Props {
  tab: ProfileTab;
  item: AlbumPhotoWithMeta | EventWithMeta;
  numColumns: number;
  cardWidth?: number;
  cardHeight?: number;
  mediaHeight?: number;
  onOpenAlbum: () => void;
  onOpenEvent: () => void;
  onPrefetchEvent?: (eventId: string) => void;
  onPrefetchProfile?: (username: string) => void;
  onOpenProfile: (username: string) => void;
  profileAccountType?: "club" | "student";
  profileOwnerUsername?: string;
  profileOwnerUserId?: string;
  menuActions?: OverflowActionItem[];
  menuTitle?: string;
  isTourTarget?: boolean;
}

export const ProfileTileCard = memo(function ProfileTileCard({
  tab,
  item,
  numColumns,
  cardWidth,
  cardHeight,
  mediaHeight,
  onOpenAlbum,
  onOpenEvent,
  onPrefetchEvent,
  onPrefetchProfile,
  onOpenProfile,
  profileAccountType,
  profileOwnerUsername,
  profileOwnerUserId,
  menuActions = [],
  menuTitle,
  isTourTarget = false,
}: Props) {
  const resolvedCardWidth = cardWidth || (numColumns === 3 ? 112 : 168);
  const resolvedCardHeight = cardHeight || (numColumns === 3 ? 156 : 196);
  const resolvedMediaHeight = mediaHeight || Math.max(82, Math.floor(resolvedCardHeight * 0.67));
  const showAlbumOwner =
    tab === "album" &&
    profileAccountType === "club" &&
    !isClubOwnedAlbum(item as AlbumPhotoWithMeta, profileOwnerUsername, profileOwnerUserId);

  if (tab === "album") {
    const albumItem = item as AlbumPhotoWithMeta;
    const visibility = buildPreparedAlbumVisibility(albumItem, "profile");
    return (
      <TourAnchor
        tourId="profile-feed-card"
        enabled={isTourTarget}
        style={{ width: resolvedCardWidth }}
      >
        <DiscoveryAlbumGridCard
          item={albumItem}
          cardWidth={resolvedCardWidth}
          cardHeight={resolvedCardHeight}
          mediaHeight={resolvedMediaHeight}
          showOwner={showAlbumOwner}
          visibility={visibility}
          onPrefetchEvent={onPrefetchEvent}
          onPress={onOpenAlbum}
        />
      </TourAnchor>
    );
  }

  if (tab === "events") {
    const eventItem = item as EventWithMeta;
    return (
      <TourAnchor
        tourId="profile-feed-card"
        enabled={isTourTarget}
        style={{ width: resolvedCardWidth }}
      >
        <DiscoveryEventGridCard
          access={resolveProfileEventAccess(eventItem)}
          item={eventItem}
          cardWidth={resolvedCardWidth}
          cardHeight={resolvedCardHeight}
          mediaHeight={resolvedMediaHeight}
          showOwner={false}
          onPrefetchEvent={onPrefetchEvent}
          onPress={onOpenEvent}
        />
      </TourAnchor>
    );
  }

  const normalizedUserItem = normalizeProfileTileUserModel(item);
  const userItemWithTypedAccountType = {
    ...normalizedUserItem,
    accountType: normalizedUserItem.accountType as "student" | "club" | undefined,
  };

  return (
    <TourAnchor
      tourId="profile-feed-card"
      enabled={isTourTarget}
      style={{ width: resolvedCardWidth }}
    >
      <DiscoveryUserGridCard
        item={userItemWithTypedAccountType}
        cardWidth={resolvedCardWidth}
        cardHeight={resolvedCardHeight}
        mediaHeight={resolvedMediaHeight}
        menuActions={menuActions}
        menuTitle={menuTitle}
        onPrefetchProfile={onPrefetchProfile}
        onPress={(user) => onOpenProfile(user.username || userItemWithTypedAccountType.username)}
      />
    </TourAnchor>
  );
});
