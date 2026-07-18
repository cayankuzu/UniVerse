import { FeedToast } from "../../../shared/components";
import {
  AlbumDetailViewerOverlay,
  EventDetailViewerOverlay,
} from "../../../features/content-cards/public/overlays";
import type { AccountType, AuthUserData } from "../../../features/content-cards/public/types";
import type { AlbumPhotoWithMeta, EventWithMeta, RelationSnapshot } from "../data/searchTypes";

interface Props {
  accountType: AccountType;
  albums: AlbumPhotoWithMeta[];
  events: EventWithMeta[];
  initialItemId?: string | null;
  onCloseViewer: () => void;
  onOpenAlbum: (eventId: string) => void;
  onOpenClubProfile: (username: string) => void;
  onOpenEventFromAlbum: (eventId: string) => void;
  onOpenUserProfile: (username: string) => void;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
  relationByClub: Record<string, RelationSnapshot>;
  setWarningMessage: (message: string) => void;
  viewer: AuthUserData;
  viewerIndex: number;
  viewerType: "events" | "albums" | null;
  warningMessage: string | null;
}

export function SearchFeedViewers({
  accountType,
  albums,
  events,
  initialItemId,
  onCloseViewer,
  onOpenAlbum,
  onOpenClubProfile,
  onOpenEventFromAlbum,
  onOpenUserProfile,
  onRefresh,
  refreshing = false,
  relationByClub,
  setWarningMessage,
  viewer,
  viewerIndex,
  viewerType,
  warningMessage,
}: Props) {
  return (
    <>
      <EventDetailViewerOverlay
        accountType={accountType}
        data={events}
        initialIndex={viewerIndex}
        initialItemId={viewerType === "events" ? initialItemId : null}
        onClose={onCloseViewer}
        onOpenAlbum={onOpenAlbum}
        onOpenClub={onOpenClubProfile}
        onRefresh={onRefresh}
        onShowWarning={setWarningMessage}
        refreshing={refreshing}
        relationByClub={relationByClub}
        viewer={viewer}
        visible={viewerType === "events"}
      />

      <AlbumDetailViewerOverlay
        context="search"
        data={albums}
        initialIndex={viewerIndex}
        initialItemId={viewerType === "albums" ? initialItemId : null}
        onClose={onCloseViewer}
        onOpenClub={onOpenClubProfile}
        onOpenEvent={onOpenEventFromAlbum}
        onOpenProfile={onOpenUserProfile}
        onRefresh={onRefresh}
        onShowWarning={setWarningMessage}
        refreshing={refreshing}
        relationByClub={relationByClub}
        viewer={viewer}
        visible={viewerType === "albums"}
      />

      <FeedToast message={warningMessage} />
    </>
  );
}
