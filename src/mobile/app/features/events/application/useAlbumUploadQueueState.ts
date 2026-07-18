import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { EventDetailProjection } from "../../../data/projections/projections.types";
import { subscribeQueueResumeSignal } from "../../../data/queues/runtimeSignals";
import {
  createPendingAlbumUpload,
  enqueuePendingAlbumUpload,
  listPendingAlbumPhotos,
  processAlbumUploadQueue,
  type AlbumUploadQueueUser,
  type PendingAlbumPhoto,
} from "../data";

type Params = {
  accountType: "club" | "student";
  event: EventDetailProjection["event"] | null;
  eventId: string;
  queryClient: QueryClient;
  userData: AlbumUploadQueueUser;
  viewerKey: string;
};

export function useAlbumUploadQueueState({
  accountType,
  event,
  eventId,
  queryClient,
  userData,
  viewerKey,
}: Params) {
  const [pendingPhotos, setPendingPhotos] = useState<PendingAlbumPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const didResumeQueueRef = useRef(false);

  const syncPendingAlbumQueue = useCallback(async () => {
    const nextPendingPhotos = await listPendingAlbumPhotos({
      event,
      eventId,
      ownerId: userData.id,
      userData,
    });
    setPendingPhotos(nextPendingPhotos);
  }, [event, eventId, userData]);

  const processAlbumUploads = useCallback(async () => {
    setUploading(true);
    try {
      await processAlbumUploadQueue({
        accountType,
        eventId,
        ownerId: userData.id,
        queryClient,
        userData,
        viewerKey,
      });
    } finally {
      await syncPendingAlbumQueue();
      setUploading(false);
    }
  }, [accountType, eventId, queryClient, syncPendingAlbumQueue, userData, viewerKey]);

  const queueAlbumUpload = useCallback(
    async (params: {
      caption?: string;
      images: string[];
      mediaKinds: Array<"image" | "video">;
      showOnClubProfile?: boolean;
      showOnOwnProfile?: boolean;
      title?: string;
    }) => {
      const { payload, pendingPhoto } = createPendingAlbumUpload({
        ...params,
        event,
        eventId,
        userData,
      });
      if (!payload.images.length) {
        return "";
      }

      setPendingPhotos((previous) => [pendingPhoto, ...previous]);
      await enqueuePendingAlbumUpload({
        entryId: pendingPhoto.id,
        eventId,
        imageCount: payload.images.length,
        ownerId: userData.id,
        payload,
        viewerKey,
      });
      void processAlbumUploads();
      return pendingPhoto.id;
    },
    [event, eventId, processAlbumUploads, userData, viewerKey],
  );

  useEffect(() => {
    void syncPendingAlbumQueue();
  }, [syncPendingAlbumQueue]);

  useEffect(() => {
    const unsubscribe = subscribeQueueResumeSignal("upload", () => {
      void syncPendingAlbumQueue();
    });
    return unsubscribe;
  }, [syncPendingAlbumQueue]);

  useEffect(() => {
    if (didResumeQueueRef.current) return;
    didResumeQueueRef.current = true;
    void processAlbumUploads();
  }, [processAlbumUploads]);

  return {
    pendingPhotos,
    processAlbumUploads,
    queueAlbumUpload,
    setPendingPhotos,
    syncPendingAlbumQueue,
    uploading,
  };
}
