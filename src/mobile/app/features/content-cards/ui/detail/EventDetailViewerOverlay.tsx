import { useCallback } from "react";
import type { AccountType, AuthUserData, EventWithMeta, RelationSnapshot } from "../../data";
import { EventDetailCard } from "./EventDetailCard";
import { DetailViewerOverlayLayout } from "./DetailViewerOverlayLayout";
import { useDetailViewerOverlayState } from "./useDetailViewerOverlayState";
import { normalizeViewerRelationKey } from "./viewerTarget";

type Props = {
  accountType: AccountType;
  data: EventWithMeta[];
  initialIndex: number;
  initialItemId?: string | null;
  onClose: () => void;
  onOpenAlbum: (eventId: string) => void;
  onOpenClub: (username: string) => void;
  onRefresh?: () => Promise<void> | void;
  onShowWarning?: (message: string) => void;
  refreshing?: boolean;
  relationByClub: Record<string, RelationSnapshot>;
  viewer: AuthUserData;
  visible: boolean;
};

export function EventDetailViewerOverlay({
  accountType,
  data,
  initialIndex,
  initialItemId,
  onClose,
  onOpenAlbum,
  onOpenClub,
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
      listType: "events",
      onClose,
      visible,
    });

  const renderCard = useCallback(
    (item: EventWithMeta) => (
      <EventDetailCard
        accountType={accountType}
        event={item}
        onOpenAlbum={onOpenAlbum}
        onOpenClub={onOpenClub}
        onShowWarning={onShowWarning}
        relations={relationByClub[normalizeViewerRelationKey(item.clubUsername)]}
        viewer={viewer}
      />
    ),
    [accountType, onOpenAlbum, onOpenClub, onShowWarning, relationByClub, viewer],
  );

  return (
    <DetailViewerOverlayLayout
      contentContainerStyle={contentContainerStyle}
      data={viewerData.data}
      estimatedItemSize={428}
      focusedItem={focusedItem}
      headerTitle="Etkinlikler"
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
