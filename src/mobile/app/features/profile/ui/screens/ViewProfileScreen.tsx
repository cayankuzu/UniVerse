import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../app-shell/auth";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import {
  useOpenAlbumView,
  useOpenEventDetail,
  useOpenProfileWithOptions,
} from "../../../../app-shell/navigation/hooks/useIntentNavigation";
import { t } from "../../../../shared/i18n";
import { useViewProfile } from "../../application/useViewProfile";
import type { ProfileTab } from "../../domain/profileConstants";
import type { UserProfile } from "../../application/profileUiModels";
import { estimateProfilePagerHeights } from "../profilePagerLayout";
import { ProfileActionMenu } from "./ProfileActionMenu";
import { ProfileContentPager } from "./ProfileContentPager";
import { ProfileHeaderContainer } from "./ProfileHeaderContainer";
import { ProfilePagedScrollContainer } from "./ProfilePagedScrollContainer";
import { ProfileReportModal } from "./ProfileReportModal";
import { ProfileScreenOverlays } from "./ProfileScreenOverlays";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { useProfileScreenChromeState } from "../useProfileScreenChromeState";
import { useViewProfileScreenActions } from "../useViewProfileScreenActions";
import { ViewProfileBlockedState, ViewProfileLockedState } from "./ViewProfileLockedState";

type Props = NativeStackScreenProps<RootStackParamList, "ViewProfile">;
const EMPTY_PROFILE_TILE_DATA: never[] = [];
const EMPTY_PROFILE: UserProfile = {
  accountType: "student",
  categories: [],
  coverImage: "",
  createdAt: "",
  email: "",
  followersCount: 0,
  followingCount: 0,
  id: "",
  isPrivate: false,
  profileImage: "",
  university: "",
  username: "",
};
type ScrollToOffsetHandle = {
  scrollToOffset: (params: { animated: boolean; offset: number }) => void;
};

export function ViewProfileScreen({ route, navigation }: Props) {
  const username = String(route.params?.username || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  const insets = useSafeAreaInsets();
  const { accountType, blockUser, blockedUsers, isBlocked, unblockUser, userData } = useAuth();
  const chromeState = useProfileScreenChromeState();
  const {
    closeImageViewer,
    closeMenu,
    closeReportModal,
    closeViewer,
    completeReport,
    failReport,
    openMenu,
    openReportModal,
    reportSubmitted,
    setViewerImage,
    setViewerIndex,
    setViewerTargetId,
    setViewerType,
    setWarningMessage,
    showMenu,
    showReportModal,
    viewerImage,
    viewerIndex,
    viewerTargetId,
    viewerType,
    warningMessage,
  } = chromeState;
  const state = useViewProfile(
    {
      accountType,
      blockUser,
      blockedUsers,
      isBlocked,
      unblockUser,
      userData,
      username,
    },
    { onWarningMessage: setWarningMessage },
  );
  const {
    accountType: profileAccountType,
    albumOwnerFilter,
    albumOwnerFilterExpanded,
    albumRelationByClub,
    albums,
    albumsQuery,
    canViewContent,
    canViewFollowers,
    canViewFollowing,
    contentLockedMessage,
    contentWarningMessage,
    displayName,
    emptyText,
    eventRelationByClub,
    events,
    eventsQuery,
    followersAccess,
    followAction,
    followLabel,
    followMutation,
    followVariant,
    followingAccess,
    grid,
    isClub,
    isLockedProfile,
    isOwnProfile,
    isTargetBlocked,
    loadMore,
    loadingMore,
    numColumns,
    onRefresh,
    privateNoticeText,
    profile,
    profileLoading,
    profileQuery,
    refreshing,
    runBlockToggle,
    runReport,
    setAlbumOwnerFilter,
    setAlbumOwnerFilterExpanded,
    setTab,
    showPrivateNotice,
    tab,
    tabs,
    userIsBlocked,
    prefetchEventById,
    prefetchProfileByUsername,
  } = state;
  const profileListRef = useRef<ScrollToOffsetHandle | null>(null);
  const [visibleProfileTab, setVisibleProfileTab] = useState<ProfileTab>(tab);
  const [measuredPagerHeights, setMeasuredPagerHeights] = useState<
    Partial<Record<ProfileTab, number>>
  >({});
  const viewerIntentContext = useMemo(
    () => ({
      id: userData.id,
      username: userData.username,
    }),
    [userData.id, userData.username],
  );
  const openEventDetail = useOpenEventDetail(navigation, viewerIntentContext);
  const openAlbumView = useOpenAlbumView(navigation, viewerIntentContext);
  const openProfile = useOpenProfileWithOptions(navigation, viewerIntentContext, {
    method: "push",
  });
  const viewProfileBlockLabel = isTargetBlocked ? t("viewProfile.blocked.unblock") : "Engelle";
  const profileOwnerId = useMemo(
    () => String(profile?.id || "").trim() || undefined,
    [profile?.id],
  );
  const profileOwnerUsername = useMemo(
    () =>
      String(profile?.username || "")
        .trim()
        .toLowerCase(),
    [profile?.username],
  );
  const resolvedProfile = useMemo<UserProfile>(() => profile || EMPTY_PROFILE, [profile]);
  const emptyStateText = canViewContent ? emptyText : contentLockedMessage;
  const albumsLoading = canViewContent && albumsQuery.isLoading;
  const eventsLoading = canViewContent && eventsQuery.isLoading;
  const albumsError = canViewContent && Boolean(albumsQuery.error);
  const eventsError = canViewContent && Boolean(eventsQuery.error);
  useEffect(() => {
    setVisibleProfileTab(tab);
  }, [tab]);
  useEffect(() => {
    setMeasuredPagerHeights({});
  }, [
    albums.length,
    canViewContent,
    events.length,
    grid.cardHeight,
    grid.rowGap,
    state.hasMore,
    numColumns,
    username,
  ]);
  const pagerHeights = useMemo(
    () =>
      estimateProfilePagerHeights({
        cardHeight: grid.cardHeight,
        hasMore: state.hasMore,
        numColumns,
        rowGap: grid.rowGap,
        tabs: {
          album: canViewContent ? albums : EMPTY_PROFILE_TILE_DATA,
          events: canViewContent ? events : EMPTY_PROFILE_TILE_DATA,
        },
      }),
    [albums, canViewContent, events, grid.cardHeight, grid.rowGap, numColumns, state.hasMore],
  );
  const pagerHeight = Math.max(
    measuredPagerHeights[tab] ?? pagerHeights[tab],
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
  const applyProfileTab = useCallback(
    (nextTab: ProfileTab) => {
      if (nextTab === tab) {
        profileListRef.current?.scrollToOffset({ offset: 0, animated: true });
        return;
      }
      setVisibleProfileTab(nextTab);
      setTab(nextTab);
      if (nextTab !== "album") {
        setAlbumOwnerFilterExpanded(false);
      }
    },
    [setAlbumOwnerFilterExpanded, setTab, tab],
  );
  const handleSetTab = useCallback(
    (nextTab: typeof tab) => {
      applyProfileTab(nextTab);
    },
    [applyProfileTab],
  );
  const {
    confirmBlockToggle,
    handleFollowPress,
    handleLoadMore,
    handleProfileReport,
    navigateFollowers,
    navigateFollowing,
    openAlbumAt,
    openContentProfile,
    openEventAt,
    openFollowersList,
    openFollowingList,
  } = useViewProfileScreenActions({
    albums,
    canViewContent,
    canViewFollowers,
    canViewFollowing,
    completeReport,
    contentWarningMessage,
    events,
    failReport,
    followersAccess,
    followAction,
    followingAccess,
    isTargetBlocked,
    loadMore,
    loadingMore,
    navigation,
    openProfile,
    profile,
    runBlockToggle,
    runReport,
    setViewerIndex,
    setViewerTargetId,
    setViewerType,
    setWarningMessage,
  });
  const handlePreviewTab = useCallback((nextTab: ProfileTab) => {
    setVisibleProfileTab(nextTab);
  }, []);
  const renderHeader = () => (
    <ProfileHeaderContainer
      albumOwnerFilter={albumOwnerFilter}
      albumOwnerFilterExpanded={albumOwnerFilterExpanded}
      canViewContent={canViewContent}
      canViewFollowers={canViewFollowers}
      canViewFollowing={canViewFollowing}
      contentWarningMessage={contentWarningMessage}
      disableStatsActions={showPrivateNotice}
      displayName={displayName}
      followersAccess={followersAccess}
      followLabel={followLabel}
      followVariant={followVariant}
      followingAccess={followingAccess}
      isOwnProfile={isOwnProfile}
      onFollowPress={handleFollowPress}
      onNavigateFollowers={navigateFollowers}
      onNavigateFollowing={navigateFollowing}
      onOpenImage={setViewerImage}
      onSetAlbumOwnerFilter={setAlbumOwnerFilter}
      onSetTab={handleSetTab}
      onSetWarningMessage={setWarningMessage}
      onToggleAlbumOwnerFilter={() => setAlbumOwnerFilterExpanded((previous) => !previous)}
      privateNoticeText={privateNoticeText}
      profile={resolvedProfile}
      showAlbumOwnerFilter={canViewContent && isClub}
      showPrivateNotice={showPrivateNotice}
      tab={visibleProfileTab}
      tabs={tabs}
    />
  );

  if (userIsBlocked) {
    return (
      <>
        <ViewProfileBlockedState
          displayName={displayName}
          onBack={() => navigation.goBack()}
          onReport={openReportModal}
          onUnblock={confirmBlockToggle}
          profile={profile}
          username={username}
        />
        <ProfileReportModal
          modalBottomPadding={Math.max(insets.bottom + 12, 12)}
          onClose={closeReportModal}
          onReport={handleProfileReport}
          reportSubmitted={reportSubmitted}
          visible={showReportModal}
        />
      </>
    );
  }

  return (
    <>
      <ProfileScreenShell
        empty={!profileLoading && !profile && !isLockedProfile}
        emptyText={t("viewProfile.empty.user")}
        error={profileQuery.error && !isLockedProfile ? t("viewProfile.error.load") : null}
        loading={profileLoading}
        onBack={() => navigation.goBack()}
        onOpenMenu={openMenu}
        showMenuButton={!isOwnProfile}
        title={username ? `@${username}` : t("viewProfile.title")}
      >
        {!profile && isLockedProfile ? (
          <ViewProfileLockedState
            accountType={profileAccountType}
            contentLockedMessage={contentLockedMessage}
            displayName={displayName}
            followLabel={followLabel}
            followLoading={followMutation.isPending}
            followVariant={followVariant}
            isOwnProfile={isOwnProfile}
            onFollowPress={handleFollowPress}
            onOpenFollowers={openFollowersList}
            onOpenFollowing={openFollowingList}
            profile={profile}
          />
        ) : profile ? (
          <ProfilePagedScrollContainer
            header={renderHeader()}
            listRef={profileListRef}
            onEndReached={state.hasMore === false ? undefined : handleLoadMore}
            onRefresh={onRefresh}
            pager={
              <ProfileContentPager
                activeTab={tab}
                albumData={canViewContent ? albums : EMPTY_PROFILE_TILE_DATA}
                albumsError={albumsError}
                albumsLoading={albumsLoading}
                cardHeight={grid.cardHeight}
                cardWidth={grid.cardWidth}
                emptyText={emptyStateText}
                enabled={canViewContent && tabs.length > 1}
                eventData={canViewContent ? events : EMPTY_PROFILE_TILE_DATA}
                eventsError={eventsError}
                eventsLoading={eventsLoading}
                gridHorizontalPadding={grid.horizontalPadding}
                gridRowGap={grid.rowGap}
                hasMore={state.hasMore}
                loadingMore={Boolean(loadingMore)}
                mediaHeight={grid.mediaHeight}
                numColumns={numColumns}
                onContentHeightChange={handlePagerContentHeightChange}
                onOpenAlbumAt={openAlbumAt}
                onOpenEventAt={openEventAt}
                onOpenProfile={openContentProfile}
                onPrefetchEvent={prefetchEventById}
                onPrefetchProfile={prefetchProfileByUsername}
                onTabChange={handleSetTab}
                onTabPreviewChange={handlePreviewTab}
                pagerHeight={pagerHeight}
                profileAccountType={profileAccountType}
                profileOwnerId={profileOwnerId}
                profileOwnerUsername={profileOwnerUsername}
              />
            }
            refreshing={refreshing}
          />
        ) : null}
      </ProfileScreenShell>

      <ProfileActionMenu
        blockLabel={viewProfileBlockLabel}
        bottomPadding={insets.bottom}
        onClose={closeMenu}
        onConfirmBlockToggle={confirmBlockToggle}
        onConfirmReport={openReportModal}
        visible={showMenu}
      />

      <ProfileScreenOverlays
        accountType={profileAccountType}
        albums={albums}
        albumRelationByClub={albumRelationByClub}
        eventRelationByClub={eventRelationByClub}
        events={events}
        initialItemId={viewerTargetId}
        onCloseImageViewer={closeImageViewer}
        onCloseViewer={closeViewer}
        onOpenAlbum={openAlbumView}
        onOpenEvent={openEventDetail}
        onOpenProfile={openContentProfile}
        onRefresh={onRefresh}
        onShowWarning={setWarningMessage}
        refreshing={refreshing}
        viewer={userData}
        viewerImage={viewerImage}
        viewerIndex={viewerIndex}
        viewerType={viewerType}
        warningMessage={warningMessage}
      />

      <ProfileReportModal
        modalBottomPadding={Math.max(insets.bottom + 12, 12)}
        onClose={closeReportModal}
        onReport={handleProfileReport}
        reportSubmitted={reportSubmitted}
        visible={showReportModal}
      />
    </>
  );
}
