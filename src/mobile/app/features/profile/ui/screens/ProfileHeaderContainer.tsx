import { memo, useCallback } from "react";
import type { AlbumOwnerFilter, ProfileTab } from "../../domain/profileConstants";
import type { UserProfile } from "../../application/profileUiModels";
import { ViewProfileContentHeader } from "./ViewProfileContentHeader";

type AccessState = {
  allowed: boolean;
  warningMessage: string | null;
};

type Props = {
  albumOwnerFilter: AlbumOwnerFilter;
  albumOwnerFilterExpanded: boolean;
  canViewContent: boolean;
  canViewFollowers: boolean;
  canViewFollowing: boolean;
  contentWarningMessage: string | null;
  disableStatsActions: boolean;
  displayName: string;
  followersAccess: AccessState;
  followLabel: string;
  followVariant: "primary" | "ghost" | "secondary";
  followingAccess: AccessState;
  isOwnProfile: boolean;
  onFollowPress: () => void;
  onNavigateFollowers: (username: string) => void;
  onNavigateFollowing: (username: string) => void;
  onOpenImage: (imageUri: string) => void;
  onSetAlbumOwnerFilter: (value: AlbumOwnerFilter) => void;
  onSetTab: (tab: ProfileTab) => void;
  onSetWarningMessage: (message: string | null) => void;
  onToggleAlbumOwnerFilter: () => void;
  privateNoticeText?: string;
  profile: UserProfile;
  showAlbumOwnerFilter: boolean;
  showPrivateNotice: boolean;
  tab: ProfileTab;
  tabs: Array<{ key: ProfileTab; label: string; count: number }>;
};

export const ProfileHeaderContainer = memo(function ProfileHeaderContainer({
  albumOwnerFilter,
  albumOwnerFilterExpanded,
  canViewContent,
  canViewFollowers,
  canViewFollowing,
  contentWarningMessage,
  disableStatsActions,
  displayName,
  followersAccess,
  followLabel,
  followVariant,
  followingAccess,
  isOwnProfile,
  onFollowPress,
  onNavigateFollowers,
  onNavigateFollowing,
  onOpenImage,
  onSetAlbumOwnerFilter,
  onSetTab,
  onSetWarningMessage,
  onToggleAlbumOwnerFilter,
  privateNoticeText,
  profile,
  showAlbumOwnerFilter,
  showPrivateNotice,
  tab,
  tabs,
}: Props) {
  const showLockedWarning = useCallback(() => {
    onSetWarningMessage(contentWarningMessage || "Bu hesabın içerikleri görüntülenemiyor.");
  }, [contentWarningMessage, onSetWarningMessage]);
  const openFollowers = useCallback(() => {
    if (!profile.username) return;
    if (!canViewFollowers || !followersAccess.allowed) {
      onSetWarningMessage(
        followersAccess.warningMessage || "Takipçi listesi bu kullanıcı için sınırlı.",
      );
      return;
    }
    onNavigateFollowers(profile.username);
  }, [
    canViewFollowers,
    followersAccess.allowed,
    followersAccess.warningMessage,
    onNavigateFollowers,
    onSetWarningMessage,
    profile.username,
  ]);
  const openFollowing = useCallback(() => {
    if (!profile.username) return;
    if (!canViewFollowing || !followingAccess.allowed) {
      onSetWarningMessage(
        followingAccess.warningMessage || "Takip listesi bu kullanıcı için sınırlı.",
      );
      return;
    }
    onNavigateFollowing(profile.username);
  }, [
    canViewFollowing,
    followingAccess.allowed,
    followingAccess.warningMessage,
    onNavigateFollowing,
    onSetWarningMessage,
    profile.username,
  ]);
  const openCover = useCallback(() => {
    if (!canViewContent) {
      showLockedWarning();
      return;
    }
    if (profile.coverImage) {
      onOpenImage(profile.coverImage);
    }
  }, [canViewContent, onOpenImage, profile.coverImage, showLockedWarning]);
  const openAvatar = useCallback(() => {
    if (!canViewContent) {
      showLockedWarning();
      return;
    }
    if (profile.profileImage) {
      onOpenImage(profile.profileImage);
    }
  }, [canViewContent, onOpenImage, profile.profileImage, showLockedWarning]);

  return (
    <ViewProfileContentHeader
      albumOwnerFilter={albumOwnerFilter}
      albumOwnerFilterExpanded={albumOwnerFilterExpanded}
      disableStatsActions={disableStatsActions}
      displayName={displayName}
      followLabel={followLabel}
      followVariant={followVariant}
      isOwnProfile={isOwnProfile}
      onFollowPress={onFollowPress}
      onOpenAvatar={openAvatar}
      onOpenCover={openCover}
      onOpenFollowers={openFollowers}
      onOpenFollowing={openFollowing}
      onSetAlbumOwnerFilter={onSetAlbumOwnerFilter}
      onSetTab={onSetTab}
      onToggleAlbumOwnerFilter={onToggleAlbumOwnerFilter}
      privateNoticeText={privateNoticeText}
      profile={profile}
      showAlbumOwnerFilter={showAlbumOwnerFilter}
      showPrivateNotice={showPrivateNotice}
      tab={tab}
      tabs={tabs}
    />
  );
});
