import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewToken } from "@shopify/flash-list";
import { appendProjectionFieldUris } from "../../../data/projections/projectionImages.shared";
import { STARTUP_PERFORMANCE_BUDGET } from "../../../data/projections/performanceBudget";
import { getMediaUriCacheKey } from "../../../shared/media/mediaUri";
import { isVideoMediaUri } from "../../../shared/media/mediaVideoUtils";
import { preloadMediaSources } from "../../../shared/media/preloadMediaSources";
import type { HomeFeedItem } from "../data";

function buildHomeRowKey(item: HomeFeedItem) {
  return `${item.kind}:${item.id}`;
}

type ViewabilityInfo = {
  changed: ViewToken<HomeFeedItem>[];
  viewableItems: ViewToken<HomeFeedItem>[];
};

type UseHomeVisibleMediaUpgradeParams = {
  allowMediaUpgrade: boolean;
  filterScope: string;
  items: HomeFeedItem[];
  onViewableItemsChanged?: (info: ViewabilityInfo) => void;
  viewerKey: string;
};

function collectHomeMediaUris(items: HomeFeedItem[]) {
  const uris: string[] = [];
  items.forEach((item) => {
    const media = item.kind === "event" ? item.event : item.album;
    if (!media) return;
    const rawUri = String(media.image || "").trim();
    appendProjectionFieldUris(uris, {
      imageLimit: 1,
      preferredOrder: ["medium", "thumbnail", "full"],
      rawFallback: !isVideoMediaUri(rawUri),
      rawUri,
      variants: media.imageVariants,
    });
  });
  return Array.from(new Set(uris)).slice(0, STARTUP_PERFORMANCE_BUDGET.criticalAboveFoldImages);
}

export function useHomeVisibleMediaUpgrade(params: UseHomeVisibleMediaUpgradeParams) {
  const {
    allowMediaUpgrade,
    filterScope,
    items,
    onViewableItemsChanged: onViewable,
    viewerKey,
  } = params;
  const [visibleRowKeys, setVisibleRowKeys] = useState<string[]>([]);
  const [readyMediaRowKeys, setReadyMediaRowKeys] = useState<Set<string>>(() => new Set());
  const readyMediaRowKeysRef = useRef<Set<string>>(new Set());
  const preloadedMediaKeysRef = useRef(new Set<string>());

  const preloadItems = useCallback((nextItems: HomeFeedItem[]) => {
    const nextEntries = collectHomeMediaUris(nextItems).flatMap((uri) => {
      const cacheKey = getMediaUriCacheKey(uri);
      if (!cacheKey || preloadedMediaKeysRef.current.has(cacheKey)) return [];
      preloadedMediaKeysRef.current.add(cacheKey);
      return [{ cacheKey, uri }];
    });
    if (nextEntries.length === 0) return;
    void preloadMediaSources(
      nextEntries.map((entry) => entry.uri),
      {
        allowNetworkResolve: true,
        batchSize: STARTUP_PERFORMANCE_BUDGET.criticalAboveFoldImages,
        priority: "eager",
      },
    )
      .then((resolvedCount) => {
        if (resolvedCount >= nextEntries.length) return;
        nextEntries.forEach((entry) => preloadedMediaKeysRef.current.delete(entry.cacheKey));
      })
      .catch(() => {
        nextEntries.forEach((entry) => preloadedMediaKeysRef.current.delete(entry.cacheKey));
      });
  }, []);

  const onViewableItemsChanged = useCallback(
    (info: ViewabilityInfo) => {
      onViewable?.(info);
      const nextKeys = info.viewableItems
        .map((entry) => entry.item)
        .filter((item): item is HomeFeedItem => Boolean(item))
        .map(buildHomeRowKey);
      if (allowMediaUpgrade) {
        preloadItems(
          info.viewableItems
            .map((entry) => entry.item)
            .filter((item): item is HomeFeedItem => Boolean(item)),
        );
      }
      setVisibleRowKeys((previous) =>
        previous.join("|") === nextKeys.join("|") ? previous : nextKeys,
      );
    },
    [allowMediaUpgrade, onViewable, preloadItems],
  );

  useEffect(() => {
    setVisibleRowKeys([]);
    readyMediaRowKeysRef.current = new Set();
    preloadedMediaKeysRef.current.clear();
    setReadyMediaRowKeys(new Set());
  }, [filterScope, viewerKey]);

  useEffect(() => {
    if (!allowMediaUpgrade || items.length === 0) return;
    const firstFoldItems = items.slice(0, STARTUP_PERFORMANCE_BUDGET.criticalAboveFoldImages);
    preloadItems(firstFoldItems);
    setReadyMediaRowKeys((previous) => {
      const next = new Set(previous);
      let changed = false;
      firstFoldItems.forEach((item) => {
        const key = buildHomeRowKey(item);
        if (next.has(key)) return;
        next.add(key);
        changed = true;
      });
      if (!changed) return previous;
      readyMediaRowKeysRef.current = next;
      return next;
    });
  }, [allowMediaUpgrade, filterScope, items, preloadItems, viewerKey]);

  useEffect(() => {
    if (!allowMediaUpgrade || visibleRowKeys.length === 0) return;
    const pendingKeys = visibleRowKeys.filter((key) => !readyMediaRowKeysRef.current.has(key));
    if (pendingKeys.length === 0) return;
    setReadyMediaRowKeys((previous) => {
      const next = new Set(previous);
      let changed = false;
      pendingKeys.forEach((key) => {
        if (next.has(key)) return;
        next.add(key);
        changed = true;
      });
      if (!changed) {
        return previous;
      }
      readyMediaRowKeysRef.current = next;
      return next;
    });
  }, [allowMediaUpgrade, visibleRowKeys]);

  return {
    onViewableItemsChanged,
    readyMediaRowKeys,
  };
}
