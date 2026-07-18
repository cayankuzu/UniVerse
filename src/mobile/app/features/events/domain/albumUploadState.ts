export function normalizeAlbumViewValue(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

type AlbumImageLike = {
  image?: string;
  images?: string[];
  photoCount?: number;
  uploadStatus?: "failed" | "pending" | string;
  userId?: string;
};

export function countAlbumImages(item: AlbumImageLike) {
  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images.map((value) => String(value || "").trim()).filter(Boolean).length;
  }
  if (typeof item.photoCount === "number" && item.photoCount > 0) {
    return item.photoCount;
  }
  return String(item.image || "").trim() ? 1 : 0;
}

export function computeAlbumUploadState(params: {
  maxAlbumCards: number;
  maxPhotos: number;
  pendingPhotos: AlbumImageLike[];
  persistedPhotos: AlbumImageLike[];
  selectedPhotoUris: string[];
  serverOwnAlbumCount?: number;
  userId?: string;
}) {
  const persistedOwnAlbumCount = params.persistedPhotos.reduce((sum, item) => {
    return String(item.userId || "").trim() === String(params.userId || "").trim() ? sum + 1 : sum;
  }, 0);
  const queuedOwnAlbumCount = params.pendingPhotos.reduce((sum, item) => {
    return item.uploadStatus === "pending" ? sum + 1 : sum;
  }, 0);
  const uploadedAlbumCount = Math.max(
    Number(params.serverOwnAlbumCount || 0),
    persistedOwnAlbumCount,
  );
  const reservedAlbumCount = uploadedAlbumCount + queuedOwnAlbumCount;
  const remainingAlbumSlots = Math.max(0, params.maxAlbumCards - reservedAlbumCount);
  const remainingTotalSlots = Math.max(0, params.maxPhotos - params.selectedPhotoUris.length);
  const availableSelectionSlots = remainingTotalSlots;
  return {
    availableSelectionSlots,
    remainingTotalSlots,
    remainingAlbumSlots,
    reservedAlbumCount,
    uploadedAlbumCount,
  };
}

export function hasAlbumUploadDraftChanges(params: {
  caption?: string;
  selectedPhotoUris: string[];
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
  title?: string;
}) {
  if (params.selectedPhotoUris.some((value) => String(value || "").trim().length > 0)) {
    return true;
  }
  if (String(params.title || "").trim().length > 0) {
    return true;
  }
  if (String(params.caption || "").trim().length > 0) {
    return true;
  }
  return !params.showOnClubProfile || !params.showOnOwnProfile;
}
