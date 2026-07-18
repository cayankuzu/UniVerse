import { useCallback } from "react";
import type { AlbumPhotoWithMeta, AuthUserData, RelationSnapshot } from "../../data";
import { AlbumDetailCard } from "./AlbumDetailCard";
import { DetailViewerOverlayLayout } from "./DetailViewerOverlayLayout";
import { useDetailViewerOverlayState } from "./useDetailViewerOverlayState";
import { normalizeViewerRelationKey } from "./viewerTarget";

type Props = {
  context?: "feed" | "profile" | "search";
  data: AlbumPhotoWithMeta[];
  initialIndex: number;
  initialItemId?: string | null;
  onClose: () => void;
  onOpenEvent: (eventId: string) => void;
  onOpenClub: (clubUsername: string) => void;
  onOpenProfile: (username: string) => void;
  onRefresh?: () => Promise<void> | void;
  onShowWarning?: (message: string) => void;
  refreshing?: boolean;
  relationByClub: Record<string, RelationSnapshot>;
  viewer: AuthUserData;
  visible: boolean;
};

export function AlbumDetailViewerOverlay({
  context = "profile",
  data,
  initialIndex,
  initialItemId,
  onClose,
  onOpenEvent,
  onOpenClub,
  onOpenProfile,
  onRefresh,
  onShowWarning,
  refreshing = false,
  relationByClub,
  viewer,
  visible,
}: Props) {
  const { contentContainerStyle, focusedItem, listInstanceKey, listRef, showList, viewerData } =
    useDetailViewerOverlayState({
      data,
      initialIndex,
      initialItemId,
      listType: "albums",
      onClose,
      visible,
    });

  const renderCard = useCallback(
    (item: AlbumPhotoWithMeta) => (
      <AlbumDetailCard
        context={context}
        onOpenClub={onOpenClub}
        onOpenEvent={onOpenEvent}
        onOpenProfile={onOpenProfile}
        onShowWarning={onShowWarning}
        photo={item}
        relations={relationByClub[normalizeViewerRelationKey(item.clubUsername)]}
        viewer={viewer}
      />
    ),
    [context, onOpenClub, onOpenEvent, onOpenProfile, onShowWarning, relationByClub, viewer],
  );

  return (
    <DetailViewerOverlayLayout
      contentContainerStyle={contentContainerStyle}
      data={viewerData.data}
      estimatedItemSize={408}
      focusedItem={focusedItem}
      headerTitle="Albümler"
      initialScrollIndex={viewerData.initialIndex}
      listInstanceKey={listInstanceKey}
      listRef={listRef}
      onClose={onClose}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderCard={renderCard}
      showList={showList}
      visible={visible}
    />
  );
}
