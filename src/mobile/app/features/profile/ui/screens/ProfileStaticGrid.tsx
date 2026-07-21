import { memo, useCallback, useMemo, type ReactElement } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  AppListSkeleton,
  AsyncState,
  EmptyState,
  LoadingSpinner,
} from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";
import type { ProfileTileItem } from "../../application/profileUiModels";
import type { ProfileTab } from "../../domain/profileConstants";
import { ProfileTileCard } from "./ProfileTileCard";

type Props = {
  cardHeight?: number;
  cardWidth?: number;
  data: ProfileTileItem[];
  emptyText: string;
  error: boolean;
  gridHorizontalPadding: number;
  gridRowGap: number;
  loading: boolean;
  loadingMore?: boolean;
  mediaHeight?: number;
  numColumns: number;
  onContentHeightChange?: (height: number) => void;
  onOpenAlbumAt: (item: ProfileTileItem, index: number) => void;
  onOpenEventAt: (item: ProfileTileItem, index: number) => void;
  onOpenProfile: (username: string) => void;
  onPrefetchEvent?: (eventId: string) => void;
  onPrefetchProfile?: (username: string) => void;
  profileAccountType: "club" | "student";
  profileOwnerId?: string;
  profileOwnerUsername: string;
  showEndText?: boolean;
  tab: ProfileTab;
  tourTargetIndex?: number;
};

export const ProfileStaticGrid = memo(function ProfileStaticGrid({
  cardHeight,
  cardWidth,
  data,
  emptyText,
  error,
  gridHorizontalPadding,
  gridRowGap,
  loading,
  loadingMore = false,
  mediaHeight,
  numColumns,
  onContentHeightChange,
  onOpenAlbumAt,
  onOpenEventAt,
  onOpenProfile,
  onPrefetchEvent,
  onPrefetchProfile,
  profileAccountType,
  profileOwnerId,
  profileOwnerUsername,
  showEndText = false,
  tab,
  tourTargetIndex,
}: Props) {
  const resolvedCardHeight = cardHeight || (numColumns === 3 ? 156 : 196);
  const columns = useMemo(
    () =>
      Array.from({ length: numColumns }, (_, columnIndex) =>
        data
          .map((item, index) => ({ index, item }))
          .filter(({ index }) => index % numColumns === columnIndex),
      ),
    [data, numColumns],
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onContentHeightChange?.(Math.ceil(event.nativeEvent.layout.height));
    },
    [onContentHeightChange],
  );
  const renderItem = useCallback(
    (item: ProfileTileItem, index: number) => (
      <View key={`${tab}:${String(item?.id || index)}`} style={styles.cell}>
        <ProfileTileCard
          cardHeight={cardHeight}
          cardWidth={cardWidth}
          item={item}
          mediaHeight={mediaHeight}
          numColumns={numColumns}
          onOpenAlbum={() => onOpenAlbumAt(item, index)}
          onOpenEvent={() => onOpenEventAt(item, index)}
          onOpenProfile={onOpenProfile}
          onPrefetchEvent={onPrefetchEvent}
          onPrefetchProfile={onPrefetchProfile}
          profileAccountType={profileAccountType}
          profileOwnerUserId={profileOwnerId}
          profileOwnerUsername={profileOwnerUsername}
          isTourTarget={index === tourTargetIndex}
          tab={tab}
        />
      </View>
    ),
    [
      cardHeight,
      cardWidth,
      mediaHeight,
      numColumns,
      onOpenAlbumAt,
      onOpenEventAt,
      onOpenProfile,
      onPrefetchEvent,
      onPrefetchProfile,
      profileAccountType,
      profileOwnerId,
      profileOwnerUsername,
      tab,
      tourTargetIndex,
    ],
  );
  const emptyContent = useMemo<ReactElement>(() => {
    if (loading) {
      return (
        <AppListSkeleton
          columns={numColumns}
          horizontalPadding={gridHorizontalPadding}
          itemHeight={resolvedCardHeight}
          variant="grid"
        />
      );
    }
    if (error) {
      return (
        <AsyncState
          error={tab === "album" ? t("profile.error.albums") : t("profile.error.events")}
          loading={false}
        >
          <View />
        </AsyncState>
      );
    }
    return <EmptyState title={emptyText} />;
  }, [emptyText, error, gridHorizontalPadding, loading, numColumns, resolvedCardHeight, tab]);

  return (
    <View onLayout={handleLayout} style={styles.content} testID={`profile-static-grid-${tab}`}>
      {data.length === 0 || loading || error ? (
        <View style={styles.emptyContent}>{emptyContent}</View>
      ) : (
        <View style={[styles.grid, { gap: gridRowGap, paddingHorizontal: gridHorizontalPadding }]}>
          {columns.map((columnItems, columnIndex) => (
            <View key={`column:${columnIndex}`} style={[styles.column, { gap: gridRowGap }]}>
              {columnItems.map(({ item, index }) => renderItem(item, index))}
            </View>
          ))}
        </View>
      )}
      {data.length > 0 && loadingMore ? (
        <View style={styles.footer}>
          <LoadingSpinner size="small" />
          <Text style={styles.footerText}>{t("common.loading")}</Text>
        </View>
      ) : null}
      {data.length > 0 && showEndText ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("common.list.end")}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  cell: {
    width: "100%",
  },
  column: {
    flex: 1,
  },
  content: {
    paddingBottom: tokens.spacing.lg,
  },
  emptyContent: {
    minHeight: 224,
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.spacing.smPlus,
  },
  footerText: {
    color: tokens.colors.muted,
    fontSize: tokens.typography.caption,
  },
  grid: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
});
