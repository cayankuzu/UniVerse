import { isRetryableUploadError } from "../../../data/queues/uploadQueue";
import { StorageAPI } from "../../../data/storage/storage";
import type {
  StorageUploadFile,
  StorageUploadSessionTicket,
} from "../../../platform/api/contracts";
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

type PreparedAlbumMediaUpload = PendingAlbumMediaUpload & {
  checksumSha256: string;
  file: StorageUploadFile;
  sizeBytes: number;
};

type PatchAlbumUploadProgress = (params: {
  payload: Record<string, unknown>;
  percent: number;
  stage: string;
}) => Promise<Record<string, unknown>>;

const IMAGE_PREPARE_CONCURRENCY = 2;
const VIDEO_PREPARE_CONCURRENCY = 1;
const MEDIA_UPLOAD_CONCURRENCY = 2;
const PROGRESS_WRITE_INTERVAL_MS = 250;
const SLOW_UPLINK_BYTES_PER_SECOND = 128 * 1024;
const UPLOAD_TIMEOUT_GRACE_MS = 60_000;
const MAX_MEDIA_UPLOAD_TIMEOUT_MS = 30 * 60_000;

function nowMs() {
  return Date.now();
}

function buildUploadedImages(images: string[], uploadedUrls: string[]) {
  return images.map((_image, uploadIndex) => uploadedUrls[uploadIndex] || "");
}

export function resolvePreparedMediaUploadTimeoutMs(params: {
  baseTimeoutMs: number;
  mediaKind: "image" | "video" | undefined;
  sizeBytes: number;
}) {
  if (params.mediaKind !== "video" || params.sizeBytes <= 0) return params.baseTimeoutMs;
  const slowUplinkBudgetMs =
    Math.ceil((params.sizeBytes / SLOW_UPLINK_BYTES_PER_SECOND) * 1000) + UPLOAD_TIMEOUT_GRACE_MS;
  return Math.max(params.baseTimeoutMs, Math.min(MAX_MEDIA_UPLOAD_TIMEOUT_MS, slowUplinkBudgetMs));
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let cursor = 0;
  let firstError: unknown;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (cursor < items.length && !firstError) {
        const item = items[cursor];
        cursor += 1;
        try {
          await task(item);
        } catch (error) {
          firstError ||= error;
        }
      }
    },
  );
  await Promise.all(workers);
  if (firstError) throw firstError;
}

async function prepareAlbumMedia(params: {
  authHints: AlbumUploadAuthHints;
  entryId: string;
  getTimeoutMs: (mediaKind: "image" | "video" | undefined) => number;
  onPrepared: (completed: number, total: number) => Promise<void>;
  pendingUploads: PendingAlbumMediaUpload[];
}) {
  const preparedMedia = new Map<number, PreparedAlbumMediaUpload>();
  let completed = 0;
  let progressLane = Promise.resolve();
  const prepareOne = async (media: PendingAlbumMediaUpload) => {
    const sourceInfo = resolveMediaUploadFileInfo(media.sourceUri, {
      baseName: "album",
      kind: media.mediaKind,
    });
    const file = await StorageAPI.prepareUploadFile(
      {
        name: sourceInfo.name,
        type: sourceInfo.type,
        uri: media.sourceUri,
      },
      "albums",
      {
        accessToken: params.authHints.accessTokenHint,
        context: `album/prepare:${params.entryId}:${media.index + 1}`,
        timeoutMs: params.getTimeoutMs(media.mediaKind),
      },
    );
    const integrity = await calculateLocalFileIntegrity(file.uri);
    preparedMedia.set(media.index, {
      ...integrity,
      ...media,
      file,
    });
    completed += 1;
    const completedSnapshot = completed;
    progressLane = progressLane.then(() =>
      params.onPrepared(completedSnapshot, params.pendingUploads.length),
    );
    await progressLane;
  };

  const images = params.pendingUploads.filter((item) => item.mediaKind !== "video");
  const videos = params.pendingUploads.filter((item) => item.mediaKind === "video");
  const preparationResults = await Promise.allSettled([
    runWithConcurrency(images, IMAGE_PREPARE_CONCURRENCY, prepareOne),
    runWithConcurrency(videos, VIDEO_PREPARE_CONCURRENCY, prepareOne),
  ]);
  await progressLane;
  const failedPreparation = preparationResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failedPreparation) throw failedPreparation.reason;
  return preparedMedia;
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
  let progressWriteLane = Promise.resolve();
  let progressWriteError: unknown;
  let lastProgressPercent = 21;
  let lastProgressWriteAt = 0;
  const uploadController = new AbortController();
  const sentBytesByIndex = new Map<number, number>();

  const preparedMedia = await prepareAlbumMedia({
    authHints: params.authHints,
    entryId: params.entryId,
    getTimeoutMs: params.getTimeoutMs,
    onPrepared: async (completed, total) => {
      payload = await params.patchProgress({
        payload,
        percent: 14 + Math.round((completed / total) * 8),
        stage: `Medyalar hazirlaniyor (${completed}/${total})`,
      });
    },
    pendingUploads: params.pendingUploads,
  });
  const totalBytes = Array.from(preparedMedia.values()).reduce(
    (sum, item) => sum + item.sizeBytes,
    0,
  );

  const session = await StorageAPI.createUploadSession({
    accessToken: params.authHints.accessTokenHint,
    folder: "albums",
    items: params.pendingUploads.map(({ index }) => {
      const fileInfo = preparedMedia.get(index);
      if (!fileInfo) throw new Error("Medya dosyasi dogrulanamadi.");
      return {
        checksum: fileInfo.checksumSha256,
        contentType: fileInfo.file.type || "application/octet-stream",
        expectedSizeBytes: fileInfo.sizeBytes,
        mediaIndex: index,
        sourceName: fileInfo.file.name || `album-${index + 1}`,
      };
    }),
    mutationId: params.uploadSeed,
  });
  const sessionTickets = new Map<number, StorageUploadSessionTicket>();
  session.tickets.forEach((ticket) => sessionTickets.set(ticket.mediaIndex, ticket));
  if (params.pendingUploads.some(({ index }) => !sessionTickets.has(index))) {
    throw new Error("Upload session medya bileti eksik.");
  }
  payload = {
    ...payload,
    uploadSessionId: session.sessionId,
  };
  params.logStep("session:create", {
    count: session.tickets.length,
    sessionId: session.sessionId,
  });

  const queueProgressWrite = (force: boolean) => {
    const sentBytes = Array.from(sentBytesByIndex.values()).reduce((sum, value) => sum + value, 0);
    const transferPercent = totalBytes > 0 ? Math.min(1, sentBytes / totalBytes) : 0;
    const percent = 22 + Math.round(transferPercent * 56);
    const timestamp = nowMs();
    if (
      !force &&
      (percent <= lastProgressPercent ||
        timestamp - lastProgressWriteAt < PROGRESS_WRITE_INTERVAL_MS)
    ) {
      return progressWriteLane;
    }
    lastProgressPercent = Math.max(lastProgressPercent, percent);
    lastProgressWriteAt = timestamp;
    const progressPercent = lastProgressPercent;
    const progressStage = `Medyalar yukleniyor (${completedUploads}/${params.pendingUploads.length}, %${Math.round(
      transferPercent * 100,
    )})`;
    progressWriteLane = progressWriteLane
      .then(async () => {
        payload = await params.patchProgress({
          payload: {
            ...payload,
            uploadedImages: buildUploadedImages(params.images, params.uploadedUrls),
          },
          percent: progressPercent,
          stage: progressStage,
        });
      })
      .catch((error) => {
        progressWriteError ||= error;
        uploadController.abort();
      });
    return progressWriteLane;
  };

  try {
    await runWithConcurrency(
      params.pendingUploads,
      MEDIA_UPLOAD_CONCURRENCY,
      async ({ index, mediaKind, sourceUri }) => {
        if (uploadController.signal.aborted)
          throw progressWriteError || new Error("Upload cancelled.");
        await params.assertActive(payload);
        const prepared = preparedMedia.get(index);
        const sessionTicket = sessionTickets.get(index);
        if (!prepared || !sessionTicket) throw new Error("Medya dosyasi dogrulanamadi.");
        const mediaStartedAt = nowMs();
        const timeoutMs = resolvePreparedMediaUploadTimeoutMs({
          baseTimeoutMs: params.getTimeoutMs(mediaKind),
          mediaKind,
          sizeBytes: prepared.sizeBytes,
        });
        params.logStep("media:start", {
          index: index + 1,
          mediaKind: mediaKind || "image",
          sizeBytes: prepared.sizeBytes,
          timeoutMs,
        });

        try {
          const uploadedUrl = await StorageAPI.uploadPreparedFile(prepared.file, "albums", {
            accessToken: params.authHints.accessTokenHint,
            context: `album/upload:${params.entryId}:${index + 1}`,
            onProgress: (sentBytes) => {
              const boundedBytes = Math.max(
                sentBytesByIndex.get(index) || 0,
                Math.min(prepared.sizeBytes, Math.max(0, sentBytes)),
              );
              sentBytesByIndex.set(index, boundedBytes);
              void queueProgressWrite(false);
            },
            sessionTicket,
            signal: uploadController.signal,
            timeoutMs,
            uploadKey: `${params.uploadSeed}:${index + 1}`,
          });
          await params.assertActive(payload);
          params.uploadedUrls[index] = uploadedUrl;
          sentBytesByIndex.set(index, prepared.sizeBytes);
          completedUploads += 1;
          const durationMs = Math.max(1, nowMs() - mediaStartedAt);
          params.logStep("media:done", {
            durationMs,
            index: index + 1,
            mediaKind: mediaKind || "image",
            sizeBytes: prepared.sizeBytes,
            throughputBps: Math.round((prepared.sizeBytes * 1000) / durationMs),
          });
          await queueProgressWrite(true);
          if (progressWriteError) throw progressWriteError;
        } catch (error) {
          params.logError("media:error", error);
          uploadController.abort();
          throw params.toSourceError(error, sourceUri);
        }
      },
    );
    await progressWriteLane;
    if (progressWriteError) throw progressWriteError;
    return payload;
  } catch (error) {
    uploadController.abort();
    await progressWriteLane;
    const retryable = isRetryableUploadError(error);
    if (!retryable) {
      await StorageAPI.cancelUploadSession(
        session.sessionId,
        params.authHints.accessTokenHint,
      ).catch((cancelError) => params.logError("session:cancel:error", cancelError));
      params.uploadedUrls.fill("");
    }
    await params.patchProgress({
      payload: {
        ...payload,
        uploadedImages: buildUploadedImages(params.images, params.uploadedUrls),
        uploadSessionId: retryable ? session.sessionId : null,
      },
      percent: retryable ? lastProgressPercent : 22,
      stage: "Yukleme tekrar denenecek",
    });
    throw error;
  }
}
