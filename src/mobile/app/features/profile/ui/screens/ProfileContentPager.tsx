import { memo } from "react";
import { View } from "react-native";
import { SwipeableTabPager } from "../../../../shared/components/SwipeableTabPager";
import { PROFILE_TAB_ORDER, type ProfileTab } from "../../domain/profileConstants";
import type { ProfileTileItem } from "../../application/profileUiModels";
import { ProfileStaticGrid } from "./ProfileStaticGrid";

type Props = {
  activeTab: ProfileTab;
  albumData: ProfileTileItem[];
  albumsError: boolean;
  albumsLoading: boolean;
  cardHeight?: number;
  cardWidth?: number;
  emptyText: string;
  enabled?: boolean;
  eventData: ProfileTileItem[];
  eventsError: boolean;
  eventsLoading: boolean;
  gridHorizontalPadding: number;
  gridRowGap: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  mediaHeight?: number;
  numColumns: number;
  onContentHeightChange: (tab: ProfileTab, height: number) => void;
  onOpenAlbumAt: (item: ProfileTileItem, index: number) => void;
  onOpenEventAt: (item: ProfileTileItem, index: number) => void;
  onOpenProfile: (username: string) => void;
  onPageProgressChange?: (pageOffset: number) => void;
  onPrefetchEvent?: (eventId: string) => void;
  onPrefetchProfile?: (username: string) => void;
  onTabChange: (tab: ProfileTab) => void;
  onTabPreviewChange: (tab: ProfileTab) => void;
  pagerHeight: number;
  profileAccountType: "club" | "student";
  profileOwnerId?: string;
  profileOwnerUsername: string;
  tourTargetIndex?: number;
};

export const ProfileContentPager = memo(function ProfileContentPager({
  activeTab,
  albumData,
  albumsError,
  albumsLoading,
  cardHeight,
  cardWidth,
  emptyText,
  enabled = true,
  eventData,
  eventsError,
  eventsLoading,
  gridHorizontalPadding,
  gridRowGap,
  hasMore,
  loadingMore = false,
  mediaHeight,
  numColumns,
  onContentHeightChange,
  onOpenAlbumAt,
  onOpenEventAt,
  onOpenProfile,
  onPageProgressChange,
  onPrefetchEvent,
  onPrefetchProfile,
  onTabChange,
  onTabPreviewChange,
  pagerHeight,
  profileAccountType,
  profileOwnerId,
  profileOwnerUsername,
  tourTargetIndex,
}: Props) {
  return (
    <View style={{ height: pagerHeight, width: "100%" }} testID="profile-content-pager">
      <SwipeableTabPager
        activeTab={activeTab}
        enabled={enabled && PROFILE_TAB_ORDER.length > 1}
        keepAlive={false}
        lazy
        onChange={onTabChange}
        onPageProgressChange={onPageProgressChange}
        onPreviewTabChange={onTabPreviewChange}
        renderPage={(tab) => (
          <ProfileStaticGrid
            cardHeight={cardHeight}
            cardWidth={cardWidth}
            data={tab === "album" ? albumData : eventData}
            emptyText={emptyText}
            error={tab === "album" ? albumsError : eventsError}
            gridHorizontalPadding={gridHorizontalPadding}
            gridRowGap={gridRowGap}
            loading={tab === "album" ? albumsLoading : eventsLoading}
            loadingMore={tab === activeTab && loadingMore}
            mediaHeight={mediaHeight}
            numColumns={numColumns}
            onContentHeightChange={(height) => onContentHeightChange(tab, height)}
            onOpenAlbumAt={onOpenAlbumAt}
            onOpenEventAt={onOpenEventAt}
            onOpenProfile={onOpenProfile}
            onPrefetchEvent={onPrefetchEvent}
            onPrefetchProfile={onPrefetchProfile}
            profileAccountType={profileAccountType}
            profileOwnerId={profileOwnerId}
            profileOwnerUsername={profileOwnerUsername}
            showEndText={tab === activeTab && hasMore === false}
            tab={tab}
            tourTargetIndex={tab === activeTab ? tourTargetIndex : undefined}
          />
        )}
        tabs={PROFILE_TAB_ORDER}
      />
    </View>
  );
});
