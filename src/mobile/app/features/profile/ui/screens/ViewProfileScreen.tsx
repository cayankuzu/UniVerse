import { useCallback, useMemo } from "react";
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
import type { UserProfile } from "../../application/profileUiModels";
import { ProfileActionMenu } from "./ProfileActionMenu";
import { ProfileContentContainer } from "./ProfileContentContainer";
import { ProfileHeaderContainer } from "./ProfileHeaderContainer";
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
    tileData,
    userIsBlocked,
    viewportPrefetch,
    prefetchEventById,
    prefetchProfileByUsername,
  } = state;
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
  const visibleTileData = canViewContent ? tileData : EMPTY_PROFILE_TILE_DATA;
  const emptyStateText = canViewContent ? emptyText : contentLockedMessage;
  const albumsLoading = canViewContent && albumsQuery.isLoading;
  const eventsLoading = canViewContent && eventsQuery.isLoading;
  const albumsError = canViewContent && Boolean(albumsQuery.error);
  const eventsError = canViewContent && Boolean(eventsQuery.error);
  const handleSetTab = useCallback(
    (nextTab: typeof tab) => {
      setTab(nextTab);
      if (nextTab !== "album") {
        setAlbumOwnerFilterExpanded(false);
      }
    },
    [setAlbumOwnerFilterExpanded, setTab],
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
  const header = useMemo(
    () => (
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
        tab={tab}
        tabs={tabs}
      />
    ),
    [
      albumOwnerFilter,
      albumOwnerFilterExpanded,
      canViewContent,
      canViewFollowers,
      canViewFollowing,
      contentWarningMessage,
      displayName,
      followersAccess,
      followLabel,
      followVariant,
      followingAccess,
      handleFollowPress,
      handleSetTab,
      isClub,
      isOwnProfile,
      navigateFollowers,
      navigateFollowing,
      privateNoticeText,
      resolvedProfile,
      setAlbumOwnerFilter,
      setAlbumOwnerFilterExpanded,
      setViewerImage,
      setWarningMessage,
      showPrivateNotice,
      tab,
      tabs,
    ],
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
          <ProfileContentContainer
            albumData={canViewContent ? albums : EMPTY_PROFILE_TILE_DATA}
            albumsError={albumsError}
            albumsLoading={albumsLoading}
            cardHeight={grid.cardHeight}
            cardWidth={grid.cardWidth}
            emptyText={emptyStateText}
            eventData={canViewContent ? events : EMPTY_PROFILE_TILE_DATA}
            eventsError={eventsError}
            eventsLoading={eventsLoading}
            gridHorizontalPadding={grid.horizontalPadding}
            gridRowGap={grid.rowGap}
            hasMore={state.hasMore}
            header={header}
            loadingMore={Boolean(loadingMore)}
            mediaHeight={grid.mediaHeight}
            numColumns={numColumns}
            onLoadMore={handleLoadMore}
            onOpenAlbumAt={openAlbumAt}
            onOpenEventAt={openEventAt}
            onOpenProfile={openContentProfile}
            onPrefetchEvent={prefetchEventById}
            onPrefetchProfile={prefetchProfileByUsername}
            onRefresh={onRefresh}
            onSetTab={canViewContent ? handleSetTab : undefined}
            onViewableItemsChanged={viewportPrefetch.onViewableItemsChanged}
            pagerEnabled={canViewContent && tabs.length > 1}
            profileAccountType={profileAccountType}
            profileOwnerId={profileOwnerId}
            profileOwnerUsername={profileOwnerUsername}
            refreshing={refreshing}
            tab={tab}
            tileData={visibleTileData}
            viewabilityConfig={viewportPrefetch.viewabilityConfig}
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
