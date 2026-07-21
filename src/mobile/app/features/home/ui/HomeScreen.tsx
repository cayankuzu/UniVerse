import type { ReactNode } from "react";
import { useCallback } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HomeFeedInteractionOverlay } from "../../../features/content-cards/public/overlays";
import { useAuth } from "../../../app-shell/auth";
import { tokens } from "../../../shared/theme";
import { FeedToast } from "../../../shared/components";
import type { RootStackParamList } from "../../../app-shell/navigation/types";
import { TourAnchor } from "../../../app-shell/onboarding";
import { useTabReselectCounter } from "../../../app-shell/navigation/TabReselectContext";
import { useHomeScreenState } from "../application/useHomeScreenState";
import { HomeFilterPanel } from "./HomeFilterPanel";
import { HomeFeedList } from "./HomeFeedList";
import { HomeScreenHeader } from "./HomeScreenHeader";
import { HomeAlbumRow } from "./HomeAlbumRow";
import { HomeEventRow } from "./HomeEventRow";
import { useHomeScreenActions } from "./useHomeScreenActions";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;
const HOME_HIGH_PRIORITY_ROW_LIMIT = 2;

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function renderHomeTourAnchor(props: {
  children: ReactNode;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tourId: string;
}) {
  return (
    <TourAnchor enabled={props.enabled} style={props.style} tourId={props.tourId}>
      {props.children}
    </TourAnchor>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { accountType, blockedUsers, userData } = useAuth();
  const homeReselectCounter = useTabReselectCounter("home");
  const {
    activeFilterCount,
    albumRelationByClub,
    bottomPadding,
    defaultSource,
    errorMessage,
    eventRelationByClub,
    filteredItems,
    hasMore,
    listRef,
    loadMore,
    loadState,
    loadingMore,
    onNotificationsPressIn,
    onFeedFirstDraw,
    onRefresh,
    onUserInteraction,
    onViewableItemsChanged,
    refreshing,
    setEntityFilter,
    setShowFilters,
    setSourceFilter,
    setTypeFilter,
    setWarningMessage,
    showFilters,
    sourceFilter,
    tourAlbumIndex,
    tourEventIndex,
    typeFilter,
    unread,
    viewabilityConfig,
    warningMessage,
    entityFilter,
  } = useHomeScreenState({
    accountType,
    blockedUsers,
    homeReselectCounter,
    userData,
  });
  const {
    activeOverlay,
    closeActiveOverlay,
    handleOpenAlbumScreen,
    handleOpenEventFromAlbum,
    handleOpenNotifications,
    handleOpenProfile,
    openEventOverlay,
  } = useHomeScreenActions({
    navigation,
    userData,
  });
  const handleEndReached = useCallback(() => {
    if (loadingMore) return;
    void loadMore();
  }, [loadMore, loadingMore]);
  const renderFeedItem = useCallback(
    (item: (typeof filteredItems)[number], index: number) => {
      if (item.kind === "event") {
        const relations = eventRelationByClub[normalize(item.event.clubUsername || "")];
        return (
          <HomeEventRow
            accountType={accountType}
            isTourTarget={index === tourEventIndex}
            item={item}
            mediaReady={index < HOME_HIGH_PRIORITY_ROW_LIMIT}
            onOpenAlbum={handleOpenAlbumScreen}
            onOpenCard={handleOpenEventFromAlbum}
            onOpenClub={handleOpenProfile}
            onOpenOverlay={openEventOverlay}
            onShowWarning={setWarningMessage}
            renderTourAnchor={renderHomeTourAnchor}
            relations={relations}
            viewer={userData}
          />
        );
      }

      const relations = albumRelationByClub[normalize(item.album.clubUsername || "")];
      return (
        <HomeAlbumRow
          currentUsername={userData.username}
          isTourTarget={index === tourAlbumIndex}
          item={item}
          mediaReady={index < HOME_HIGH_PRIORITY_ROW_LIMIT}
          onOpenClub={handleOpenProfile}
          onOpenEvent={handleOpenEventFromAlbum}
          onOpenProfile={handleOpenProfile}
          onShowWarning={setWarningMessage}
          renderTourAnchor={renderHomeTourAnchor}
          relations={relations}
          viewer={userData}
        />
      );
    },
    [
      accountType,
      albumRelationByClub,
      eventRelationByClub,
      handleOpenAlbumScreen,
      handleOpenEventFromAlbum,
      handleOpenProfile,
      openEventOverlay,
      setWarningMessage,
      tourAlbumIndex,
      tourEventIndex,
      userData,
    ],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.surfaceVariant }}
      edges={["top"]}
    >
      <>
        <HomeScreenHeader
          activeFilterCount={activeFilterCount}
          onNotificationsPressIn={onNotificationsPressIn}
          onNotificationsPress={handleOpenNotifications}
          onToggleFilters={() => setShowFilters((value) => !value)}
          showFilters={showFilters}
          unread={unread}
        />
        <HomeFilterPanel
          visible={showFilters}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          entityFilter={entityFilter}
          setEntityFilter={setEntityFilter}
          onReset={() => {
            setSourceFilter(defaultSource);
            setTypeFilter("all");
            setEntityFilter("all");
          }}
        />
      </>

      <HomeFeedList
        bottomPadding={bottomPadding}
        data={filteredItems}
        errorMessage={errorMessage}
        hasMore={hasMore}
        listRef={listRef}
        loadState={loadState}
        loadingMore={loadingMore}
        onEndReached={handleEndReached}
        onFirstDraw={onFeedFirstDraw}
        onRefresh={onRefresh}
        onUserInteraction={onUserInteraction}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshing={refreshing}
        renderFeedItem={renderFeedItem}
        viewabilityConfig={viewabilityConfig}
      />

      <HomeFeedInteractionOverlay
        accountType={accountType}
        activeOverlay={activeOverlay}
        currentUsername={userData.username}
        onDismiss={closeActiveOverlay}
        onOpenEvent={handleOpenEventFromAlbum}
        onOpenProfile={handleOpenProfile}
        onShowWarning={setWarningMessage}
        viewer={userData}
      />

      <FeedToast message={warningMessage} />
    </SafeAreaView>
  );
}
