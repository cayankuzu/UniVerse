import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { AppFlatList } from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import type { NotificationItem } from "../../data";
import type { FilterCategory } from "../../application/notificationsPresentation";
import type { UIFollowRequest } from "../../model/types";
import { NotificationListItem } from "./NotificationListItem";
import { NotificationsFollowRequestsCard } from "./NotificationsFollowRequestsCard";

type FollowRequestAction = "accept" | "reject";

type Props = {
  activeFilter: FilterCategory;
  bottomInset: number;
  handleFollowRequestAction: (item: NotificationItem, action: FollowRequestAction) => void;
  handleInlineFollowRequestAction: (request: UIFollowRequest, action: FollowRequestAction) => void;
  handleNotifPress: (item: NotificationItem) => Promise<void>;
  hasMore?: boolean;
  listItems: NotificationItem[];
  loadMore: () => Promise<unknown>;
  loadingMore: boolean;
  notificationsHasError: boolean;
  notificationsShowInitialSkeleton: boolean;
  onRefresh: () => Promise<void>;
  openProfile: (username: string) => void;
  pendingFollowRequestSet: Set<string>;
  pendingFollowRequests: Record<string, FollowRequestAction>;
  pendingInlineFollowRequests: Record<string, FollowRequestAction>;
  processedFollowRequests: Record<string, FollowRequestAction>;
  processedInlineFollowRequests: Record<string, FollowRequestAction>;
  refreshing: boolean;
  visibleFollowRequests: UIFollowRequest[];
};

export const NotificationsList = React.memo(function NotificationsList({
  activeFilter,
  bottomInset,
  handleFollowRequestAction,
  handleInlineFollowRequestAction,
  handleNotifPress,
  hasMore,
  listItems,
  loadMore,
  loadingMore,
  notificationsHasError,
  notificationsShowInitialSkeleton,
  onRefresh,
  openProfile,
  pendingFollowRequestSet,
  pendingFollowRequests,
  pendingInlineFollowRequests,
  processedFollowRequests,
  processedInlineFollowRequests,
  refreshing,
  visibleFollowRequests,
}: Props) {
  const emptyText =
    activeFilter === "all" ? t("notifications.empty.all") : t("notifications.empty.filtered");
  const listHeader = useMemo(() => {
    if (
      visibleFollowRequests.length === 0 ||
      (activeFilter !== "all" && activeFilter !== "social")
    ) {
      return null;
    }

    return (
      <NotificationsFollowRequestsCard
        requests={visibleFollowRequests}
        pendingActions={pendingInlineFollowRequests}
        processedActions={processedInlineFollowRequests}
        onOpenProfile={openProfile}
        onAction={handleInlineFollowRequestAction}
      />
    );
  }, [
    activeFilter,
    handleInlineFollowRequestAction,
    openProfile,
    pendingInlineFollowRequests,
    processedInlineFollowRequests,
    visibleFollowRequests,
  ]);
  const renderSeparator = useCallback(() => <View style={{ height: 8 }} />, []);
  const handleEndReached = useCallback(() => {
    if (loadingMore) return;
    void loadMore();
  }, [loadMore, loadingMore]);
  const renderNotificationItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const followPendingAction = pendingFollowRequests[item.id];

      return (
        <NotificationListItem
          item={item}
          pendingFollowRequestSet={pendingFollowRequestSet}
          processedFollowAction={processedFollowRequests[item.id]}
          followPending={Boolean(followPendingAction)}
          followPendingAction={followPendingAction}
          onOpenProfile={openProfile}
          onPress={() => {
            void handleNotifPress(item);
          }}
          onFollowAction={handleFollowRequestAction}
        />
      );
    },
    [
      handleFollowRequestAction,
      handleNotifPress,
      openProfile,
      pendingFollowRequestSet,
      pendingFollowRequests,
      processedFollowRequests,
    ],
  );

  return (
    <AppFlatList
      data={listItems}
      contentContainerStyle={{
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: Math.max(bottomInset + 24, 30),
      }}
      estimatedItemSize={124}
      emptyText={emptyText}
      error={notificationsHasError ? t("notifications.error.load") : null}
      getItemType={(item) => item.type || "notification"}
      hasMore={hasMore}
      ItemSeparatorComponent={renderSeparator}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      loading={notificationsShowInitialSkeleton}
      loadingMore={loadingMore}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.82}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderItem={renderNotificationItem}
    />
  );
});
