import { memo } from "react";
import { FeedToast, type OverflowActionItem } from "../../../../shared/components";
import {
  AlbumDetailViewerOverlay,
  EventDetailViewerOverlay,
} from "../../../../features/content-cards/public/overlays";
import type {
  AccountType,
  AlbumPhotoWithMeta,
  AuthUserData,
  EventWithMeta,
  RelationSnapshot,
} from "../../../../features/content-cards/public/types";
import { MediaViewerModal } from "../../../../shared/media/MediaViewerModal";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import { showErrorAlert } from "../../../../shared/utils/alerts";

interface Props {
  accountType: AccountType;
  albums: AlbumPhotoWithMeta[];
  albumRelationByClub: Record<string, RelationSnapshot>;
  events: EventWithMeta[];
  eventRelationByClub: Record<string, RelationSnapshot>;
  initialItemId?: string | null;
  onCloseImageViewer: () => void;
  onCloseViewer: () => void;
  onOpenAlbum: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenProfile: (username: string) => void;
  onRefresh: () => Promise<void> | void;
  onShowWarning: (message: string | null) => void;
  refreshing: boolean;
  viewer: AuthUserData;
  viewerImage: string | null;
  viewerIndex: number;
  viewerType: "events" | "albums" | null;
  warningMessage: string | null;
}

export const ProfileScreenOverlays = memo(function ProfileScreenOverlays({
  accountType,
  albums,
  albumRelationByClub,
  events,
  eventRelationByClub,
  initialItemId,
  onCloseImageViewer,
  onCloseViewer,
  onOpenAlbum,
  onOpenEvent,
  onOpenProfile,
  onRefresh,
  onShowWarning,
  refreshing,
  viewer,
  viewerImage,
  viewerIndex,
  viewerType,
  warningMessage,
}: Props) {
  const viewerImageActions: OverflowActionItem[] = viewerImage
    ? [
        {
          key: "download",
          label: "Indir",
          onPress: () => {
            void (async () => {
              try {
                await downloadMediaToGallery({
                  uri: viewerImage,
                });
              } catch (error) {
                showErrorAlert(
                  String((error as { message?: string } | null)?.message || "İşlem tamamlanamadı."),
                  "İndirme başarısız",
                );
              }
            })();
          },
        },
      ]
    : [];

  return (
    <>
      <MediaViewerModal
        actions={viewerImageActions}
        items={viewerImage ? [{ uri: viewerImage }] : []}
        onClose={onCloseImageViewer}
        visible={!!viewerImage}
      />

      <EventDetailViewerOverlay
        accountType={accountType}
        data={events}
        initialIndex={viewerIndex}
        initialItemId={viewerType === "events" ? initialItemId : null}
        onClose={onCloseViewer}
        onOpenAlbum={onOpenAlbum}
        onOpenClub={onOpenProfile}
        onRefresh={onRefresh}
        onShowWarning={onShowWarning}
        refreshing={refreshing}
        relationByClub={eventRelationByClub}
        viewer={viewer}
        visible={viewerType === "events"}
      />

      <AlbumDetailViewerOverlay
        context="profile"
        data={albums}
        initialIndex={viewerIndex}
        initialItemId={viewerType === "albums" ? initialItemId : null}
        onClose={onCloseViewer}
        onOpenClub={onOpenProfile}
        onOpenEvent={onOpenEvent}
        onOpenProfile={onOpenProfile}
        onRefresh={onRefresh}
        onShowWarning={onShowWarning}
        refreshing={refreshing}
        relationByClub={albumRelationByClub}
        viewer={viewer}
        visible={viewerType === "albums"}
      />

      <FeedToast message={warningMessage} />
    </>
  );
});
