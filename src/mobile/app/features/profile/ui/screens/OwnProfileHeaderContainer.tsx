import { memo, useCallback } from "react";
import type { AlbumOwnerFilter, ProfileTab } from "../../domain/profileConstants";
import { ProfileAlbumOwnerFilterBar } from "./ProfileAlbumOwnerFilterBar";
import { ProfileHeaderSection } from "./ProfileHeaderSection";
import { ProfileTabsBar } from "./ProfileTabsBar";

type HeaderUserData = {
  bio?: string;
  categories?: string[];
  coverImage?: string;
  coverImageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  } | null;
  department?: string;
  description?: string;
  email?: string;
  followers?: number;
  following?: number;
  gradeYear?: string;
  hideEmail?: boolean;
  profileImage?: string;
  profileImageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  } | null;
  university?: string;
  username?: string;
};

type Props = {
  albumOwnerFilter: AlbumOwnerFilter;
  albumOwnerFilterExpanded: boolean;
  displayName: string;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
  onOpenImage: (imageUri: string) => void;
  onOpenSettings: () => void;
  onSetAlbumOwnerFilter: (value: AlbumOwnerFilter) => void;
  onSetTab: (tab: ProfileTab) => void;
  onToggleAlbumOwnerFilter: () => void;
  resolvedAccountType: "club" | "student";
  tab: ProfileTab;
  tabs: Array<{ key: ProfileTab; label: string; count: number }>;
  userData: HeaderUserData;
};

export const OwnProfileHeaderContainer = memo(function OwnProfileHeaderContainer({
  albumOwnerFilter,
  albumOwnerFilterExpanded,
  displayName,
  onOpenFollowers,
  onOpenFollowing,
  onOpenImage,
  onOpenSettings,
  onSetAlbumOwnerFilter,
  onSetTab,
  onToggleAlbumOwnerFilter,
  resolvedAccountType,
  tab,
  tabs,
  userData,
}: Props) {
  const openCover = useCallback(() => {
    if (userData.coverImage) {
      onOpenImage(userData.coverImage);
    }
  }, [onOpenImage, userData.coverImage]);
  const openAvatar = useCallback(() => {
    if (userData.profileImage) {
      onOpenImage(userData.profileImage);
    }
  }, [onOpenImage, userData.profileImage]);

  return (
    <>
      <ProfileHeaderSection
        displayName={displayName}
        onOpenAvatar={openAvatar}
        onOpenCover={openCover}
        onOpenFollowers={onOpenFollowers}
        onOpenFollowing={onOpenFollowing}
        onOpenSettings={onOpenSettings}
        userData={userData}
      />
      <ProfileTabsBar
        expandableTab={resolvedAccountType === "club" ? "album" : undefined}
        expanded={albumOwnerFilterExpanded}
        onChange={onSetTab}
        onToggleExpanded={onToggleAlbumOwnerFilter}
        tab={tab}
        tabs={tabs}
      />
      {resolvedAccountType === "club" && tab === "album" && albumOwnerFilterExpanded ? (
        <ProfileAlbumOwnerFilterBar value={albumOwnerFilter} onChange={onSetAlbumOwnerFilter} />
      ) : null}
    </>
  );
});
