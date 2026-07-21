import React, { useEffect, useMemo, useState } from "react";
import { AppText as Text } from "../components/AppText";
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppFlatList } from "../components/AppFlatList";
import { AppModalHost } from "../components/AppModalHost";
import { t } from "../i18n";
import { tokens } from "../theme";
import { MediaTile } from "./MediaLibraryPickerTile";
import {
  MediaLibraryPickerConfirmButton,
  MediaLibraryPickerEmptyState,
  MediaLibraryPickerLoadingState,
  MediaLibraryPickerPermissionState,
  MediaLibraryPickerSelectionSummary,
  MediaLibraryPickerSheetHeader,
} from "./MediaLibraryPickerSheetSections";
import {
  isSelectableVideoDuration,
  mapResolvedLibraryAssetSelection,
  type MediaSelection,
  type PickerMediaLibraryAsset,
} from "./mediaPicker";
import { useMediaLibraryPickerFeed } from "./useMediaLibraryPickerFeed";

type TabKey = "all" | "photos" | "videos";

const LIBRARY_BATCH_SIZE = 33;

type Props = {
  allowVideo: boolean;
  description?: string;
  maxSelectionCount?: number;
  onClose: () => void;
  onConfirm: (items: MediaSelection[]) => void | Promise<void>;
  selectionMode: "single" | "multiple";
  subtitle?: string;
  title: string;
  visible: boolean;
};

function mediaTypeOf(asset: MediaLibrary.Asset) {
  return String(asset.mediaType || "").toLowerCase() === "video" ? "video" : "image";
}

function isSelectable(asset: MediaLibrary.Asset, params: { allowVideo: boolean }) {
  const kind = mediaTypeOf(asset);
  if (kind === "image") return true;
  return (
    params.allowVideo &&
    isSelectableVideoDuration(typeof asset.duration === "number" ? asset.duration * 1000 : null)
  );
}

export function MediaLibraryPickerSheet({
  allowVideo,
  description,
  maxSelectionCount,
  onClose,
  onConfirm,
  selectionMode,
  subtitle,
  title,
  visible,
}: Props) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("all");
  const [selectedUris, setSelectedUris] = useState<string[]>([]);
  const {
    allAssets,
    filteredAssets,
    hasNextPage,
    loading,
    loadingMore,
    permissionDenied,
    queueLoadMore,
    refreshFeed,
    refreshing,
  } = useMediaLibraryPickerFeed({
    allowVideo,
    tab,
    visible,
  });

  useEffect(() => {
    if (!visible) return;
    setSelectedUris([]);
    setTab("all");
  }, [visible]);

  const selectedAssets = useMemo(() => {
    const assetsByUri = new Map(allAssets.map((asset) => [asset.uri, asset]));
    return selectedUris
      .map((uri) => assetsByUri.get(uri))
      .filter((asset): asset is PickerMediaLibraryAsset => Boolean(asset));
  }, [allAssets, selectedUris]);
  const gridGap = tokens.spacing.xs;
  const sheetHeight = Math.min(
    Math.max(520, Math.round(height * 0.82)),
    height - insets.top - Math.max(insets.bottom, 0) - tokens.spacing.xl,
  );
  const tileSize = Math.max(
    86,
    Math.floor((width - tokens.spacing.xl - tokens.spacing.xxl - gridGap * 2) / 3),
  );
  const listFooter = useMemo(() => {
    if (filteredAssets.length === 0) {
      return null;
    }

    if (loadingMore) {
      return (
        <View
          style={{
            paddingVertical: tokens.spacing.md,
            alignItems: "center",
            gap: tokens.spacing.xs,
          }}
        >
          <ActivityIndicator color={tokens.colors.primary} />
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.semibold,
            }}
          >
            {`${LIBRARY_BATCH_SIZE} medya yükleniyor`}
          </Text>
        </View>
      );
    }

    if (!hasNextPage) {
      return (
        <View style={{ paddingVertical: tokens.spacing.md, alignItems: "center" }}>
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              fontWeight: tokens.fontWeight.semibold,
            }}
          >
            {t("common.list.end")}
          </Text>
        </View>
      );
    }

    return null;
  }, [filteredAssets.length, hasNextPage, loadingMore]);

  const toggleAsset = (asset: MediaLibrary.Asset) => {
    const selectable = isSelectable(asset, { allowVideo });
    const uri = asset.uri;

    if (selectedUris.includes(uri)) {
      setSelectedUris((current) => current.filter((item) => item !== uri));
      return;
    }

    if (!selectable) return;

    if (selectionMode === "single") {
      setSelectedUris([uri]);
      void (async () => {
        await onConfirm([await mapResolvedLibraryAssetSelection(asset)]);
      })();
      return;
    }

    setSelectedUris((current) => {
      if (current.includes(uri)) {
        return current.filter((item) => item !== uri);
      }
      if (maxSelectionCount && current.length >= maxSelectionCount) {
        return current;
      }
      return [...current, uri];
    });
  };

  const confirmSelection = () => {
    void (async () => {
      await onConfirm(
        await Promise.all(selectedAssets.map((asset) => mapResolvedLibraryAssetSelection(asset))),
      );
    })();
  };

  return (
    <AppModalHost
      accessibilityAnnouncement={title}
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: tokens.colors.overlayDark,
          justifyContent: "flex-end",
          padding: tokens.spacing.sm,
        }}
      >
        <Pressable
          accessibilityLabel={title}
          accessibilityRole="menu"
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            height: sheetHeight,
            borderRadius: tokens.radius["3xl"],
            backgroundColor: tokens.colors.surface,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: tokens.colors.border,
            ...tokens.shadow.lg,
          }}
        >
          <MediaLibraryPickerSheetHeader
            allowVideo={allowVideo}
            description={description}
            onClose={onClose}
            onTabChange={setTab}
            subtitle={subtitle}
            tab={tab}
            title={title}
          />

          <View
            style={{
              flex: 1,
              minHeight: 0,
              padding: tokens.spacing.md,
              gap: tokens.spacing.sm,
            }}
          >
            {loading ? (
              <MediaLibraryPickerLoadingState />
            ) : permissionDenied ? (
              <MediaLibraryPickerPermissionState onClose={onClose} />
            ) : (
              <AppFlatList
                data={filteredAssets}
                keyExtractor={(item) => item.id}
                numColumns={3}
                estimatedItemSize={tileSize + tokens.spacing.xl}
                style={{ flex: 1, minHeight: 0 }}
                hasMore={hasNextPage}
                removeClippedSubviews={Platform.OS === "android"}
                onRefresh={refreshFeed}
                refreshing={refreshing}
                onEndReached={hasNextPage ? queueLoadMore : undefined}
                onEndReachedThreshold={0.35}
                contentContainerStyle={{
                  paddingBottom: tokens.spacing.xs,
                  flexGrow: filteredAssets.length ? undefined : 1,
                }}
                columnWrapperStyle={{
                  columnGap: tokens.spacing.xs,
                  marginBottom: tokens.spacing.xs,
                }}
                ListFooterComponent={listFooter}
                ListEmptyComponent={<MediaLibraryPickerEmptyState tab={tab} />}
                renderItem={({ item, index }) => {
                  const kind = mediaTypeOf(item);
                  const durationMs =
                    typeof item.duration === "number" ? item.duration * 1000 : null;
                  const selectedNumber = selectedUris.indexOf(item.uri) + 1;
                  const longVideo = kind === "video" && !isSelectableVideoDuration(durationMs);

                  return (
                    <View style={{ width: tileSize }}>
                      <MediaTile
                        asset={item}
                        disabled={!isSelectable(item, { allowVideo }) && selectedNumber <= 0}
                        index={index}
                        kind={kind}
                        isLongVideo={longVideo}
                        onPress={() => toggleAsset(item)}
                        selectedNumber={selectedNumber > 0 ? selectedNumber : undefined}
                        size={tileSize}
                      />
                    </View>
                  );
                }}
              />
            )}

            {selectionMode === "multiple" ? (
              <>
                <MediaLibraryPickerSelectionSummary selectedCount={selectedUris.length} />
                <MediaLibraryPickerConfirmButton
                  disabled={selectedUris.length === 0}
                  onPress={confirmSelection}
                />
              </>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}
