import { useCallback, useMemo, useState } from "react";
import type { MediaSelection } from "../../../shared/media/mediaPicker";
import { debugLog, debugWarn } from "../../../platform/logging/logger";

export function useAlbumUploadDraftState() {
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const [selectedMediaItems, setSelectedMediaItems] = useState<MediaSelection[]>([]);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");

  const selectedPhotoUris = useMemo(
    () => selectedMediaItems.map((item) => item.uri),
    [selectedMediaItems],
  );
  const normalizedSelectedPhotoIndex = useMemo(
    () =>
      selectedMediaItems.length > 0
        ? Math.min(Math.max(selectedMediaIndex, 0), selectedMediaItems.length - 1)
        : 0,
    [selectedMediaIndex, selectedMediaItems.length],
  );

  const resetUploadDraft = useCallback(() => {
    setSelectedMediaItems([]);
    setSelectedMediaIndex(0);
    setNewPhotoTitle("");
    setNewPhotoCaption("");
  }, []);

  const appendSelectedMediaItems = useCallback(
    (items: MediaSelection[], remainingSlots: number) => {
      if (!items.length || remainingSlots <= 0) return;

      setSelectedMediaItems((previous) => {
        const seenUris = new Set<string>();
        const merged = [...previous, ...items].filter((item) => {
          if (!item.uri || seenUris.has(item.uri)) {
            return false;
          }
          seenUris.add(item.uri);
          return true;
        });
        const next = merged.slice(0, previous.length + remainingSlots);
        const duplicateDropCount = previous.length + items.length - merged.length;
        const overflowDropCount = Math.max(0, merged.length - next.length);
        setSelectedMediaIndex((current) => {
          if (next.length === 0) return 0;
          if (previous.length < next.length) {
            return previous.length;
          }
          return Math.min(current, next.length - 1);
        });
        debugLog("MEDIA/ALBUM", "draft-media-appended", {
          duplicateDropCount,
          nextCount: next.length,
          overflowDropCount,
          previousCount: previous.length,
          remainingSlots,
          requestedCount: items.length,
        });
        if (duplicateDropCount > 0 || overflowDropCount > 0) {
          debugWarn("MEDIA/ALBUM", "draft-media-append-trimmed", {
            duplicateDropCount,
            nextCount: next.length,
            overflowDropCount,
            previousCount: previous.length,
            remainingSlots,
            requestedCount: items.length,
          });
        }
        return next;
      });
    },
    [],
  );

  const swapSelectedMedia = useCallback((sourceIndex: number, targetIndex: number) => {
    setSelectedMediaItems((previous) => {
      if (sourceIndex === targetIndex) return previous;
      if (sourceIndex < 0 || sourceIndex >= previous.length) return previous;
      if (targetIndex < 0 || targetIndex >= previous.length) return previous;

      const next = [...previous];
      [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
      debugLog("MEDIA/ALBUM", "draft-media-swapped", {
        count: next.length,
        sourceIndex,
        sourceUri: previous[sourceIndex]?.uri || "",
        targetIndex,
        targetUri: previous[targetIndex]?.uri || "",
      });
      setSelectedMediaIndex((current) => {
        if (current === sourceIndex) return targetIndex;
        if (current === targetIndex) return sourceIndex;
        return current;
      });

      return next;
    });
  }, []);

  const removeSelectedMedia = useCallback(
    (index: number) => {
      debugLog("MEDIA/ALBUM", "draft-media-removed", {
        count: selectedMediaItems.length,
        index,
        uri: selectedMediaItems[index]?.uri || "",
      });
      setSelectedMediaItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
      setSelectedMediaIndex((previous) => {
        if (index < 0) return 0;
        if (previous > index) return previous - 1;
        if (previous === index) return Math.max(index - 1, 0);
        return previous;
      });
    },
    [selectedMediaItems],
  );

  const replaceSelectedMedia = useCallback(
    (index: number, item: MediaSelection) => {
      debugLog("MEDIA/ALBUM", "draft-media-replaced", {
        index,
        kind: item.kind,
        nextUri: item.uri,
        previousUri: selectedMediaItems[index]?.uri || "",
      });
      setSelectedMediaItems((previous) =>
        previous.map((current, itemIndex) => (itemIndex === index ? item : current)),
      );
      setSelectedMediaIndex(index);
    },
    [selectedMediaItems],
  );

  const selectMedia = useCallback(
    (index: number) => {
      if (index < 0 || index >= selectedMediaItems.length) {
        debugWarn("MEDIA/ALBUM", "draft-media-select-out-of-range", {
          count: selectedMediaItems.length,
          index,
        });
        return;
      }
      debugLog("MEDIA/ALBUM", "draft-media-selected", {
        count: selectedMediaItems.length,
        index,
        uri: selectedMediaItems[index]?.uri || "",
      });
      setSelectedMediaIndex(index);
    },
    [selectedMediaItems],
  );

  return {
    appendSelectedMediaItems,
    newPhotoCaption,
    newPhotoTitle,
    normalizedSelectedPhotoIndex,
    removeSelectedMedia,
    replaceSelectedMedia,
    resetUploadDraft,
    selectMedia,
    selectedMediaItems,
    selectedMediaIndex,
    selectedPhotoUris,
    setNewPhotoCaption,
    setNewPhotoTitle,
    setSelectedMediaIndex,
    setSelectedMediaItems,
    setShowAddPhoto,
    showAddPhoto,
    swapSelectedMedia,
  };
}

export type AlbumUploadDraftState = ReturnType<typeof useAlbumUploadDraftState>;
