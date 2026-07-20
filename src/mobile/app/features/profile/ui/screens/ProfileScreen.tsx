import { useCallback, useEffect, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../../app-shell/auth";
import { useTabReselectCounter } from "../../../../app-shell/navigation/TabReselectContext";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import {
  useOpenAlbumView,
  useOpenEventDetail,
  useOpenProfile,
} from "../../../../app-shell/navigation/hooks/useIntentNavigation";
import { PROFILE_COLORS, type ProfileTab } from "../../domain/profileConstants";
import { useOwnProfileScreenState } from "../../application/useOwnProfileScreenState";
import { estimateProfilePagerHeights } from "../profilePagerLayout";
import { ProfileContentPager } from "./ProfileContentPager";
import { OwnProfileHeaderContainer } from "./OwnProfileHeaderContainer";
import { ProfilePagedScrollContainer } from "./ProfilePagedScrollContainer";
import { ProfileScreenOverlays } from "./ProfileScreenOverlays";
import { useProfileViewerChromeState } from "../useProfileViewerChromeState";
import { useOwnProfileScreenActions } from "../useOwnProfileScreenActions";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { accountType, blockedUsers, userData } = useAuth();
  const chromeState = useProfileViewerChromeState();
  const profileReselectCounter = useTabReselectCounter("profile");
  const openProfile = useOpenProfile(navigation, userData);
  const openAlbumView = useOpenAlbumView(navigation, userData);
  const openEventDetail = useOpenEventDetail(navigation, userData);
  const state = useOwnProfileScreenState({
    accountType,
    blockedUsers,
    onCloseViewer: chromeState.closeViewer,
    openAlbumView,
    openEventDetail,
    openFollowers: () =>
      navigation.navigate("UserList", {
        type: "followers",
        username: userData.username,
      }),
    openFollowing: () =>
      navigation.navigate("UserList", {
        type: "following",
        username: userData.username,
      }),
    openProfile,
    openSettings: () => navigation.navigate("Settings"),
    profileReselectCounter,
    userData,
  });
  const toggleAlbumOwnerFilter = state.setAlbumOwnerFilterExpanded;
  const activeProfileTab = state.tab;
  const ownProfileListRef = state.listRef;
  const setOwnProfileTab = state.handleSetTab;
  const [visibleProfileTab, setVisibleProfileTab] = useState<ProfileTab>(activeProfileTab);
  const [measuredPagerHeights, setMeasuredPagerHeights] = useState<
    Partial<Record<ProfileTab, number>>
  >({});
  const { handleLoadMore, openAlbumAt, openContentProfile, openEventAt } =
    useOwnProfileScreenActions({
      albums: state.albums,
      events: state.events,
      loadMore: state.loadMore,
      loadingMore: state.loadingMore,
      openProfile: state.handleOpenProfile,
      setViewerIndex: chromeState.setViewerIndex,
      setViewerTargetId: chromeState.setViewerTargetId,
      setViewerType: chromeState.setViewerType,
    });
  useEffect(() => {
    setVisibleProfileTab(activeProfileTab);
  }, [activeProfileTab]);
  useEffect(() => {
    setMeasuredPagerHeights({});
  }, [
    state.albums.length,
    state.events.length,
    state.grid.cardHeight,
    state.grid.rowGap,
    state.hasMore,
    state.numColumns,
  ]);
  const pagerHeights = useMemo(
    () =>
      estimateProfilePagerHeights({
        cardHeight: state.grid.cardHeight,
        hasMore: state.hasMore,
        numColumns: state.numColumns,
        rowGap: state.grid.rowGap,
        tabs: {
          album: state.albums,
          events: state.events,
        },
      }),
    [
      state.albums,
      state.events,
      state.grid.cardHeight,
      state.grid.rowGap,
      state.hasMore,
      state.numColumns,
    ],
  );
  const pagerHeight = Math.max(
    measuredPagerHeights[activeProfileTab] ?? pagerHeights[activeProfileTab],
    measuredPagerHeights[visibleProfileTab] ?? pagerHeights[visibleProfileTab],
  );
  const handlePagerContentHeightChange = useCallback((pageTab: ProfileTab, height: number) => {
    if (height <= 0) return;
    setMeasuredPagerHeights((currentHeights) => {
      const currentHeight = currentHeights[pageTab];
      if (currentHeight && Math.abs(currentHeight - height) < 1) return currentHeights;
      return { ...currentHeights, [pageTab]: height };
    });
  }, []);
  const handleProfileSetTab = useCallback(
    (nextTab: ProfileTab) => {
      if (nextTab === activeProfileTab) {
        ownProfileListRef.current?.scrollToOffset({ offset: 0, animated: true });
        return;
      }
      setVisibleProfileTab(nextTab);
      setOwnProfileTab(nextTab);
    },
    [activeProfileTab, ownProfileListRef, setOwnProfileTab],
  );
  const handleProfilePreviewTab = useCallback((nextTab: ProfileTab) => {
    setVisibleProfileTab(nextTab);
  }, []);
  const renderHeader = () => (
    <OwnProfileHeaderContainer
      albumOwnerFilter={state.albumOwnerFilter}
      albumOwnerFilterExpanded={state.albumOwnerFilterExpanded}
      displayName={state.displayName}
      onOpenFollowers={state.handleOpenFollowers}
      onOpenFollowing={state.handleOpenFollowing}
      onOpenImage={chromeState.setViewerImage}
      onOpenSettings={state.handleOpenSettings}
      onSetAlbumOwnerFilter={state.setAlbumOwnerFilter}
      onSetTab={handleProfileSetTab}
      onToggleAlbumOwnerFilter={() => toggleAlbumOwnerFilter((previous) => !previous)}
      resolvedAccountType={state.resolvedAccountType}
      tab={visibleProfileTab}
      tabs={state.tabs}
      userData={state.resolvedUserData}
    />
  );
  const profileOwnerId = useMemo(
    () => String(state.resolvedUserData.id || "").trim() || undefined,
    [state.resolvedUserData.id],
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: PROFILE_COLORS.bg }} edges={["top"]}>
      <ProfilePagedScrollContainer
        header={renderHeader()}
        listRef={ownProfileListRef}
        onEndReached={state.hasMore === false ? undefined : handleLoadMore}
        onRefresh={state.onRefresh}
        pager={
          <ProfileContentPager
            activeTab={activeProfileTab}
            albumData={state.albums}
            albumsError={Boolean(state.errorMessage)}
            albumsLoading={state.isLoading}
            cardHeight={state.grid.cardHeight}
            cardWidth={state.grid.cardWidth}
            emptyText={state.emptyText}
            enabled={state.tabs.length > 1}
            eventData={state.events}
            eventsError={Boolean(state.errorMessage)}
            eventsLoading={state.isLoading}
            gridHorizontalPadding={state.grid.horizontalPadding}
            gridRowGap={state.grid.rowGap}
            hasMore={state.hasMore}
            loadingMore={state.loadingMore}
            mediaHeight={state.grid.mediaHeight}
            numColumns={state.numColumns}
            onContentHeightChange={handlePagerContentHeightChange}
            onOpenAlbumAt={openAlbumAt}
            onOpenEventAt={openEventAt}
            onOpenProfile={openContentProfile}
            onPrefetchEvent={state.prefetchEventById}
            onPrefetchProfile={state.prefetchProfileByUsername}
            onTabChange={handleProfileSetTab}
            onTabPreviewChange={handleProfilePreviewTab}
            pagerHeight={pagerHeight}
            profileAccountType={state.resolvedAccountType}
            profileOwnerId={profileOwnerId}
            profileOwnerUsername={state.profileUsername}
            tourTargetIndex={0}
          />
        }
        refreshing={state.refreshing}
      />

      <ProfileScreenOverlays
        accountType={accountType}
        albums={state.albums}
        albumRelationByClub={state.albumRelationByClub}
        eventRelationByClub={state.eventRelationByClub}
        events={state.events}
        initialItemId={chromeState.viewerTargetId}
        onCloseImageViewer={chromeState.closeImageViewer}
        onCloseViewer={chromeState.closeViewer}
        onOpenAlbum={state.handleOpenAlbumView}
        onOpenEvent={state.handleOpenEventDetail}
        onOpenProfile={state.handleOpenProfile}
        onRefresh={state.onRefresh}
        onShowWarning={chromeState.setWarningMessage}
        refreshing={state.refreshing}
        viewer={userData}
        viewerImage={chromeState.viewerImage}
        viewerIndex={chromeState.viewerIndex}
        viewerType={chromeState.viewerType}
        warningMessage={chromeState.warningMessage}
      />
    </SafeAreaView>
  );
}
