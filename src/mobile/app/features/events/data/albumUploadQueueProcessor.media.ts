import { StorageAPI } from "../../../data/storage/storage";
import type { StorageUploadSessionTicket } from "../../../platform/api/contracts";
import { calculateLocalFileIntegrity } from "../../../platform/media/fileIntegrity";
import { resolveMediaUploadFileInfo } from "../../../shared/media/mediaVideoUtils";

type AlbumUploadAuthHints = {
  accessTokenHint?: string;
  userIdHint?: string;
};

type PendingAlbumMediaUpload = {
  index: number;
  mediaKind: "image" | "video" | undefined;
  sourceUri: string;
};

type PatchAlbumUploadProgress = (params: {
  payload: Record<string, unknown>;
  percent: number;
  stage: string;
}) => Promise<Record<string, unknown>>;

function nowMs() {
  return Date.now();
}

function buildUploadedImages(images: string[], uploadedUrls: string[]) {
  return images.map((_image, uploadIndex) => uploadedUrls[uploadIndex] || "");
}

export async function uploadPendingAlbumMedia(params: {
  assertActive: (payload?: Record<string, unknown>) => Promise<unknown>;
  authHints: AlbumUploadAuthHints;
  entryId: string;
  getTimeoutMs: (mediaKind: "image" | "video" | undefined) => number;
  images: string[];
  logError: (step: string, error: unknown) => void;
  logStep: (step: string, payload?: Record<string, unknown>) => void;
  patchProgress: PatchAlbumUploadProgress;
  payload: Record<string, unknown>;
  pendingUploads: PendingAlbumMediaUpload[];
  toSourceError: (error: unknown, sourceUri: string) => unknown;
  uploadedUrls: string[];
  uploadSeed: string;
}) {
  let payload = params.payload;
  let completedUploads = 0;
  let uploadSessionId = "";
  const sessionTickets = new Map<number, StorageUploadSessionTicket>();
  const preparedMedia = new Map<
    number,
    ReturnType<typeof resolveMediaUploadFileInfo> & {
      checksumSha256: string;
      sizeBytes: number;
    }
  >();

  if (params.pendingUploads.length > 0) {
    const preparedEntries = await Promise.all(
      params.pendingUploads.map(async ({ index, mediaKind, sourceUri }) => ({
        index,
        ...resolveMediaUploadFileInfo(sourceUri, {
          baseName: "album",
          kind: mediaKind,
        }),
        ...(await calculateLocalFileIntegrity(sourceUri)),
      })),
    );
    preparedEntries.forEach(({ index, ...prepared }) => preparedMedia.set(index, prepared));
    const session = await StorageAPI.createUploadSession({
      accessToken: params.authHints.accessTokenHint,
      folder: "albums",
      items: params.pendingUploads.map(({ index }) => {
        const fileInfo = preparedMedia.get(index);
        if (!fileInfo) throw new Error("Medya dosyasi dogrulanamadi.");
        return {
          checksum: fileInfo.checksumSha256,
          contentType: fileInfo.type,
          expectedSizeBytes: fileInfo.sizeBytes,
          mediaIndex: index,
          sourceName: fileInfo.name,
        };
      }),
      mutationId: params.uploadSeed,
    });
    uploadSessionId = session.sessionId;
    for (const ticket of session.tickets) {
      sessionTickets.set(ticket.mediaIndex, ticket);
    }
    const missingTicket = params.pendingUploads.some(({ index }) => !sessionTickets.has(index));
    if (missingTicket) throw new Error("Upload session medya bileti eksik.");
    payload = {
      ...payload,
      uploadSessionId,
    };
    params.logStep("session:create", {
      count: session.tickets.length,
      sessionId: uploadSessionId,
    });
  }

  for (const { index, mediaKind, sourceUri } of params.pendingUploads) {
    await params.assertActive(payload);
    const mediaStartedAt = nowMs();
    const uploadKey = `${params.uploadSeed}:${index + 1}`;
    const fileInfo = preparedMedia.get(index);
    if (!fileInfo) throw new Error("Medya dosyasi dogrulanamadi.");
    const timeoutMs = params.getTimeoutMs(mediaKind);
    params.logStep("media:start", {
      index: index + 1,
      mediaKind: mediaKind || "image",
      timeoutMs,
    });

    try {
      const uploadedUrl = await StorageAPI.uploadFile(
        {
          uri: sourceUri,
          name: fileInfo.name,
          type: fileInfo.type,
        },
        "albums",
        {
          accessToken: params.authHints.accessTokenHint,
          context: `album/upload:${params.entryId}:${index + 1}`,
          sessionTicket: sessionTickets.get(index),
          timeoutMs,
          uploadKey,
        },
      );
      await params.assertActive(payload);
      params.uploadedUrls[index] = uploadedUrl;
      completedUploads += 1;
      params.logStep("media:done", {
        durationMs: nowMs() - mediaStartedAt,
        index: index + 1,
        mediaKind: mediaKind || "image",
      });
      payload = await params.patchProgress({
        payload: {
          ...payload,
          uploadedImages: buildUploadedImages(params.images, params.uploadedUrls),
        },
        percent: 22 + Math.round((completedUploads / params.pendingUploads.length) * 56),
        stage: `Medyalar yukleniyor (${completedUploads}/${params.pendingUploads.length})`,
      });
    } catch (error) {
      params.logError("media:error", error);
      if (uploadSessionId) {
        await StorageAPI.cancelUploadSession(
          uploadSessionId,
          params.authHints.accessTokenHint,
        ).catch((cancelError) => params.logError("session:cancel:error", cancelError));
      }
      await params.patchProgress({
        payload: {
          ...payload,
          uploadedImages: buildUploadedImages(params.images, params.uploadedUrls),
        },
        percent: 22 + Math.round((completedUploads / params.pendingUploads.length) * 56),
        stage: "Yukleme tekrar denenecek",
      });
      throw params.toSourceError(error, sourceUri);
    }
  }

  return payload;
}
