import { useMemo } from "react";
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
import { PROFILE_COLORS } from "../../domain/profileConstants";
import { useOwnProfileScreenState } from "../../application/useOwnProfileScreenState";
import { ProfileContentContainer } from "./ProfileContentContainer";
import { OwnProfileHeaderContainer } from "./OwnProfileHeaderContainer";
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
  const header = useMemo(
    () => (
      <OwnProfileHeaderContainer
        albumOwnerFilter={state.albumOwnerFilter}
        albumOwnerFilterExpanded={state.albumOwnerFilterExpanded}
        displayName={state.displayName}
        onOpenFollowers={state.handleOpenFollowers}
        onOpenFollowing={state.handleOpenFollowing}
        onOpenImage={chromeState.setViewerImage}
        onOpenSettings={state.handleOpenSettings}
        onSetAlbumOwnerFilter={state.setAlbumOwnerFilter}
        onSetTab={state.handleSetTab}
        onToggleAlbumOwnerFilter={() => toggleAlbumOwnerFilter((previous) => !previous)}
        resolvedAccountType={state.resolvedAccountType}
        tab={state.tab}
        tabs={state.tabs}
        userData={state.resolvedUserData}
      />
    ),
    [
      chromeState.setViewerImage,
      state.albumOwnerFilter,
      state.albumOwnerFilterExpanded,
      state.displayName,
      state.handleOpenFollowers,
      state.handleOpenFollowing,
      state.handleOpenSettings,
      state.handleSetTab,
      state.resolvedAccountType,
      state.resolvedUserData,
      state.setAlbumOwnerFilter,
      toggleAlbumOwnerFilter,
      state.tab,
      state.tabs,
    ],
  );
  const profileOwnerId = useMemo(
    () => String(state.resolvedUserData.id || "").trim() || undefined,
    [state.resolvedUserData.id],
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: PROFILE_COLORS.bg }} edges={["top"]}>
      <ProfileContentContainer
        albumData={state.albums}
        albumsError={state.tab === "album" && Boolean(state.errorMessage)}
        albumsLoading={state.tab === "album" && state.isLoading}
        cardHeight={state.grid.cardHeight}
        cardWidth={state.grid.cardWidth}
        emptyText={state.emptyText}
        eventData={state.events}
        eventsError={state.tab === "events" && Boolean(state.errorMessage)}
        eventsLoading={state.tab === "events" && state.isLoading}
        gridHorizontalPadding={state.grid.horizontalPadding}
        gridRowGap={state.grid.rowGap}
        hasMore={state.hasMore}
        header={header}
        loadingMore={state.loadingMore}
        mediaHeight={state.grid.mediaHeight}
        numColumns={state.numColumns}
        onLoadMore={handleLoadMore}
        onOpenAlbumAt={openAlbumAt}
        onOpenEventAt={openEventAt}
        onOpenProfile={openContentProfile}
        onPrefetchEvent={state.prefetchEventById}
        onPrefetchProfile={state.prefetchProfileByUsername}
        onRefresh={state.onRefresh}
        onSetTab={state.handleSetTab}
        onViewableItemsChanged={state.viewportPrefetch.onViewableItemsChanged}
        pagerEnabled={state.tabs.length > 1}
        profileAccountType={state.resolvedAccountType}
        profileOwnerId={profileOwnerId}
        profileOwnerUsername={state.profileUsername}
        refreshing={state.refreshing}
        tab={state.tab}
        tileData={state.tileData}
        tourTargetIndex={0}
        viewabilityConfig={state.viewportPrefetch.viewabilityConfig}
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
