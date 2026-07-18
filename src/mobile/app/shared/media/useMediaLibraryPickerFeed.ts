import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { scheduleAfterInteractions } from "../utils/scheduleAfterInteractions";
import { hydrateLibraryAssetForPicker, type PickerMediaLibraryAsset } from "./mediaPicker";
import { generateVideoThumbnailUri } from "./videoThumbnailCache";

type TabKey = "all" | "photos" | "videos";

const LIBRARY_PAGE_SIZE = 33;
const PREPARE_CONCURRENCY = 4;
const LOAD_MORE_DELAY_MS = 64;

function mediaTypeOf(asset: MediaLibrary.Asset) {
  return String(asset.mediaType || "").toLowerCase() === "video" ? "video" : "image";
}

function buildLibraryAssetMediaTypes(allowVideo: boolean, tab: TabKey) {
  if (!allowVideo || tab === "photos") {
    return [MediaLibrary.MediaType.photo];
  }

  if (tab === "videos") {
    return [MediaLibrary.MediaType.video];
  }

  return [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
}

function buildLibraryAssetQuery(allowVideo: boolean, tab: TabKey, after?: string) {
  return {
    after,
    first: LIBRARY_PAGE_SIZE,
    mediaType: buildLibraryAssetMediaTypes(allowVideo, tab),
    resolveWithFullInfo: Platform.OS !== "android",
    sortBy: [MediaLibrary.SortBy.creationTime],
  } satisfies MediaLibrary.AssetsOptions;
}

function mergeAssetsById(current: PickerMediaLibraryAsset[], incoming: PickerMediaLibraryAsset[]) {
  if (!current.length) return incoming;
  const next = current.slice();
  const seenIds = new Set(current.map((asset) => asset.id));
  for (const asset of incoming) {
    if (seenIds.has(asset.id)) continue;
    seenIds.add(asset.id);
    next.push(asset);
  }
  return next;
}

function isRemotePreviewUri(uri: string) {
  return /^https?:/i.test(String(uri || "").trim());
}

async function resolvePickerVideoThumbnailUri(asset: PickerMediaLibraryAsset) {
  const sourceUris: string[] = [];
  const appendSourceUri = (value: string | null | undefined) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue || sourceUris.includes(normalizedValue)) return;
    sourceUris.push(normalizedValue);
  };

  appendSourceUri(asset.runtimeUri);
  appendSourceUri(asset.uri);
  appendSourceUri(asset.previewUri);
  asset.previewCandidates.forEach(appendSourceUri);

  for (const sourceUri of sourceUris) {
    const thumbnailUri = await generateVideoThumbnailUri(sourceUri, 0);
    if (thumbnailUri) {
      return thumbnailUri;
    }
  }

  return undefined;
}

async function preparePickerAsset(asset: PickerMediaLibraryAsset) {
  const previewUri = String(asset.previewUri || "").trim();
  if (previewUri && isRemotePreviewUri(previewUri)) {
    await Image.prefetch(previewUri).catch(() => false);
  }

  if (mediaTypeOf(asset) !== "video") {
    return asset;
  }

  const thumbnailUri = await resolvePickerVideoThumbnailUri(asset);
  if (!thumbnailUri) {
    return asset;
  }

  return {
    ...asset,
    previewUri: thumbnailUri,
    thumbnailUri,
  };
}

async function preparePickerAssetBatch(rawAssets: MediaLibrary.Asset[]) {
  const preparedAssets: PickerMediaLibraryAsset[] = [];

  for (let index = 0; index < rawAssets.length; index += PREPARE_CONCURRENCY) {
    const chunk = rawAssets.slice(index, index + PREPARE_CONCURRENCY);
    const preparedChunk = await Promise.all(
      chunk.map(async (rawAsset) => {
        const hydratedAsset = await hydrateLibraryAssetForPicker(rawAsset);
        return preparePickerAsset(hydratedAsset);
      }),
    );

    preparedAssets.push(...preparedChunk);

    if (index + PREPARE_CONCURRENCY < rawAssets.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return preparedAssets;
}

export function useMediaLibraryPickerFeed(params: {
  allowVideo: boolean;
  tab: TabKey;
  visible: boolean;
}) {
  const { allowVideo, tab, visible } = params;
  const [assets, setAssets] = useState<PickerMediaLibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const requestVersionRef = useRef(0);
  const loadingPageRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const hasNextPageRef = useRef(false);
  const loadMoreTaskRef = useRef<ReturnType<typeof scheduleAfterInteractions> | null>(null);

  const cancelQueuedLoadMore = useCallback(() => {
    loadMoreTaskRef.current?.cancel();
    loadMoreTaskRef.current = null;
  }, []);

  const loadAssetsPage = useCallback(
    (options?: {
      after?: string;
      refresh?: boolean;
      replace?: boolean;
      requestVersion?: number;
    }) => {
      const replace = options?.replace === true;
      if (loadingPageRef.current) return;
      if (!replace && !hasNextPageRef.current) return;

      loadingPageRef.current = true;
      if (replace) {
        setLoading(!options?.refresh);
        setLoadingMore(false);
        setRefreshing(Boolean(options?.refresh));
      } else {
        setLoadingMore(true);
      }

      const activeRequestVersion = options?.requestVersion ?? requestVersionRef.current;
      void (async () => {
        try {
          const result = await MediaLibrary.getAssetsAsync(
            buildLibraryAssetQuery(allowVideo, tab, options?.after),
          );
          const preparedAssets = await preparePickerAssetBatch(result.assets || []);
          if (activeRequestVersion !== requestVersionRef.current) return;
          nextCursorRef.current = result.hasNextPage ? result.endCursor : null;
          hasNextPageRef.current = Boolean(result.hasNextPage && result.endCursor);
          setAssets((current) =>
            replace ? preparedAssets : mergeAssetsById(current, preparedAssets),
          );
        } catch {
          if (activeRequestVersion !== requestVersionRef.current) return;
          if (replace) {
            setPermissionDenied(true);
            setAssets([]);
            nextCursorRef.current = null;
            hasNextPageRef.current = false;
          }
        } finally {
          if (activeRequestVersion === requestVersionRef.current) {
            loadingPageRef.current = false;
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
          }
        }
      })();
    },
    [allowVideo, tab],
  );

  const queueLoadMore = useCallback(() => {
    if (loading || loadingMore || permissionDenied || loadingPageRef.current) {
      return;
    }
    if (!hasNextPageRef.current || !nextCursorRef.current) return;

    cancelQueuedLoadMore();
    loadMoreTaskRef.current = scheduleAfterInteractions(() => {
      loadMoreTaskRef.current = null;
      loadAssetsPage({ after: nextCursorRef.current || undefined });
    }, LOAD_MORE_DELAY_MS);
  }, [cancelQueuedLoadMore, loadAssetsPage, loading, loadingMore, permissionDenied]);

  useEffect(() => {
    requestVersionRef.current += 1;
    cancelQueuedLoadMore();
    loadingPageRef.current = false;
    nextCursorRef.current = null;
    hasNextPageRef.current = false;

    if (!visible) return undefined;

    const requestVersion = requestVersionRef.current;
    setAssets([]);
    setLoading(true);
    setLoadingMore(false);
    setRefreshing(false);
    setPermissionDenied(false);

    void (async () => {
      try {
        const permission = await MediaLibrary.requestPermissionsAsync(
          false,
          allowVideo ? ["photo", "video"] : ["photo"],
        );
        if (requestVersion !== requestVersionRef.current) return;
        if (!permission.granted) {
          setPermissionDenied(true);
          setAssets([]);
          setLoading(false);
          return;
        }
        loadAssetsPage({ replace: true, requestVersion });
      } catch {
        if (requestVersion !== requestVersionRef.current) return;
        setPermissionDenied(true);
        setAssets([]);
        setLoading(false);
      }
    })();

    return () => {
      requestVersionRef.current += 1;
      cancelQueuedLoadMore();
      loadingPageRef.current = false;
    };
  }, [allowVideo, cancelQueuedLoadMore, loadAssetsPage, tab, visible]);

  const refreshFeed = useCallback(() => {
    if (loadingPageRef.current || loading || refreshing) return;

    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;
    cancelQueuedLoadMore();
    loadingPageRef.current = false;
    nextCursorRef.current = null;
    hasNextPageRef.current = false;
    setLoadingMore(false);
    setRefreshing(true);
    setPermissionDenied(false);

    void (async () => {
      try {
        const permission = await MediaLibrary.requestPermissionsAsync(
          false,
          allowVideo ? ["photo", "video"] : ["photo"],
        );
        if (requestVersion !== requestVersionRef.current) return;
        if (!permission.granted) {
          setPermissionDenied(true);
          setAssets([]);
          setRefreshing(false);
          return;
        }
        loadAssetsPage({
          refresh: true,
          replace: true,
          requestVersion,
        });
      } catch {
        if (requestVersion !== requestVersionRef.current) return;
        setRefreshing(false);
      }
    })();
  }, [allowVideo, cancelQueuedLoadMore, loadAssetsPage, loading, refreshing]);

  return {
    allAssets: assets,
    filteredAssets: assets,
    hasNextPage: hasNextPageRef.current,
    loading,
    loadingMore,
    permissionDenied,
    queueLoadMore,
    refreshFeed,
    refreshing,
  };
}
