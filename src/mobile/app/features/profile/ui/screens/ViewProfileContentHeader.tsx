import { memo } from "react";

import { ProfileAlbumOwnerFilterBar } from "./ProfileAlbumOwnerFilterBar";
import { ProfileTabsBar } from "./ProfileTabsBar";
import { ViewProfileHeroSection } from "./ViewProfileHeroSection";
import { ViewProfilePrivateNotice } from "./ViewProfilePrivateNotice";
import type { AlbumOwnerFilter, ProfileTab } from "../../domain/profileConstants";
import type { UserProfile } from "../../application/profileUiModels";

interface ViewProfileContentHeaderProps {
  albumOwnerFilter: AlbumOwnerFilter;
  albumOwnerFilterExpanded: boolean;
  disableStatsActions: boolean;
  displayName: string;
  followLabel: string;
  followVariant: "primary" | "ghost" | "secondary";
  isOwnProfile: boolean;
  onFollowPress: () => void;
  onOpenAvatar: () => void;
  onOpenCover: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onSetAlbumOwnerFilter: (value: AlbumOwnerFilter) => void;
  onSetTab: (tab: ProfileTab) => void;
  onToggleAlbumOwnerFilter: () => void;
  privateNoticeText?: string;
  profile: UserProfile;
  showAlbumOwnerFilter: boolean;
  showPrivateNotice: boolean;
  tab: ProfileTab;
  tabs: Array<{ key: ProfileTab; label: string; count: number }>;
}

export const ViewProfileContentHeader = memo(function ViewProfileContentHeader({
  albumOwnerFilter,
  albumOwnerFilterExpanded,
  disableStatsActions,
  displayName,
  followLabel,
  followVariant,
  isOwnProfile,
  onFollowPress,
  onOpenAvatar,
  onOpenCover,
  onOpenFollowers,
  onOpenFollowing,
  onSetAlbumOwnerFilter,
  onSetTab,
  onToggleAlbumOwnerFilter,
  privateNoticeText,
  profile,
  showAlbumOwnerFilter,
  showPrivateNotice,
  tab,
  tabs,
}: ViewProfileContentHeaderProps) {
  return (
    <>
      <ViewProfileHeroSection
        disableStatsActions={disableStatsActions}
        displayName={displayName}
        followLabel={followLabel}
        followVariant={followVariant}
        isOwnProfile={isOwnProfile}
        onFollowPress={onFollowPress}
        onOpenAvatar={onOpenAvatar}
        onOpenCover={onOpenCover}
        onOpenFollowers={onOpenFollowers}
        onOpenFollowing={onOpenFollowing}
        profile={profile}
      />
      <ViewProfilePrivateNotice text={privateNoticeText} visible={showPrivateNotice} />
      <ProfileTabsBar
        expandableTab={showAlbumOwnerFilter ? "album" : undefined}
        expanded={albumOwnerFilterExpanded}
        onChange={onSetTab}
        onToggleExpanded={onToggleAlbumOwnerFilter}
        tab={tab}
        tabs={tabs}
      />
      {showAlbumOwnerFilter && albumOwnerFilterExpanded ? (
        <ProfileAlbumOwnerFilterBar value={albumOwnerFilter} onChange={onSetAlbumOwnerFilter} />
      ) : null}
    </>
  );
});
