import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../app-shell/auth";
import { useNotificationNavigation } from "../../../../app-shell/navigation/hooks/useNotificationNavigation";
import { useOpenProfile } from "../../../../app-shell/navigation/hooks/useIntentNavigation";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { tokens } from "../../../../shared/theme";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { createNotificationsClientMutationId } from "../../data";
import { useNotificationsInbox } from "../../application/useNotificationsInbox";
import { NotificationsHeader } from "./NotificationsHeader";
import { NotificationsList } from "./NotificationsList";
import { NotificationsNotice } from "./NotificationsNotice";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

export function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomNavPadding(16, 30);
  const { blockedUsers, userData } = useAuth();
  const openProfile = useOpenProfile(navigation, {
    id: userData.id,
    username: userData.username,
  });
  const navigateForNotification = useNotificationNavigation(navigation, {
    id: userData.id,
    username: userData.username,
  });
  const {
    activeFilter,
    filterCounts,
    handleFollowRequestAction,
    handleInlineFollowRequestAction,
    handleNotifPress,
    hasMore,
    listItems,
    loadMore,
    loadingMore,
    markReadMutation,
    notice,
    notificationsQuery,
    notificationsShowInitialSkeleton,
    onRefresh,
    pendingFollowRequestSet,
    pendingFollowRequests,
    pendingInlineFollowRequests,
    processedFollowRequests,
    processedInlineFollowRequests,
    refreshing,
    setActiveFilter,
    unreadCount,
    visibleFilters,
    visibleFollowRequests,
  } = useNotificationsInbox({
    blockedUsers,
    navigateForNotification,
    openProfile,
    userData,
  });
  const handleBack = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  const handleMarkAllRead = React.useCallback(() => {
    markReadMutation.mutate({
      clientMutationId: createNotificationsClientMutationId("notifications-mark-all-read"),
    });
  }, [markReadMutation]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.surfaceVariant }}
      edges={["top", "bottom"]}
    >
      <NotificationsHeader
        activeFilter={activeFilter}
        filterCounts={filterCounts}
        unreadCount={unreadCount}
        visibleFilters={visibleFilters}
        markAllPending={markReadMutation.isPending}
        onBack={handleBack}
        onMarkAllRead={handleMarkAllRead}
        onSelectFilter={setActiveFilter}
      />
      <NotificationsNotice notice={notice} />
      <NotificationsList
        activeFilter={activeFilter}
        bottomInset={Math.max(bottomPadding - 24, insets.bottom)}
        handleFollowRequestAction={handleFollowRequestAction}
        handleInlineFollowRequestAction={handleInlineFollowRequestAction}
        handleNotifPress={handleNotifPress}
        hasMore={hasMore}
        listItems={listItems}
        loadMore={loadMore}
        loadingMore={loadingMore}
        notificationsHasError={Boolean(notificationsQuery.error)}
        notificationsShowInitialSkeleton={notificationsShowInitialSkeleton}
        onRefresh={onRefresh}
        openProfile={openProfile}
        pendingFollowRequestSet={pendingFollowRequestSet}
        pendingFollowRequests={pendingFollowRequests}
        pendingInlineFollowRequests={pendingInlineFollowRequests}
        processedFollowRequests={processedFollowRequests}
        processedInlineFollowRequests={processedInlineFollowRequests}
        refreshing={refreshing}
        visibleFollowRequests={visibleFollowRequests}
      />
    </SafeAreaView>
  );
}
