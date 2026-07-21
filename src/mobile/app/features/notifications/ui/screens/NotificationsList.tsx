import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { AppFlatList } from "../../../../shared/components";
import { AppText as Text } from "../../../../shared/components/AppText";
import { t } from "../../../../shared/i18n";
import type { NotificationItem } from "../../data";
import type { FilterCategory } from "../../application/notificationsPresentation";
import type { UIFollowRequest } from "../../model/types";
import { NotificationListItem } from "./NotificationListItem";
import { NotificationsFollowRequestsCard } from "./NotificationsFollowRequestsCard";
import { tokens } from "../../../../shared/theme";

type FollowRequestAction = "accept" | "reject";

export function resolveNotificationDayLabel(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Daha eski";

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const elapsedDays = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (elapsedDays <= 0) return "Bugün";
  if (elapsedDays === 1) return "Dün";
  if (elapsedDays < 7) return "Bu hafta";
  return "Daha eski";
}

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
    ({ item, index }: { item: NotificationItem; index: number }) => {
      const followPendingAction = pendingFollowRequests[item.id];
      const sectionLabel = resolveNotificationDayLabel(item.createdAt);
      const previousSectionLabel =
        index > 0 ? resolveNotificationDayLabel(listItems[index - 1]?.createdAt || "") : null;
      const showSectionLabel = index === 0 || sectionLabel !== previousSectionLabel;

      return (
        <View>
          {showSectionLabel ? (
            <Text
              style={{
                color: tokens.colors.textSecondary,
                fontSize: tokens.typography.caption,
                fontWeight: tokens.fontWeight.bold,
                letterSpacing: tokens.letterSpacing.helper,
                marginBottom: tokens.spacing.xs,
                marginTop: index === 0 ? 0 : tokens.spacing.xs,
              }}
            >
              {sectionLabel}
            </Text>
          ) : null}
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
        </View>
      );
    },
    [
      handleFollowRequestAction,
      handleNotifPress,
      listItems,
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
        paddingHorizontal: tokens.spacing.smPlus,
        paddingTop: tokens.spacing.compact,
        paddingBottom: Math.max(bottomInset + 24, 30),
      }}
      estimatedItemSize={148}
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
