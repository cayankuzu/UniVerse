import type {
  StorageFolder,
  StorageSignedUrlResponse,
  StorageUploadFile,
  StorageUploadOptions,
  StorageUploadSessionCreateItem,
  StorageUploadSessionResponse,
  UploadResponse,
} from "../../platform/api/contracts";
import { BASE_URL } from "../../platform/api/core";
import { SUPABASE_PUBLIC_ANON_KEY } from "../../platform/config/publicEnv";
import {
  SUPABASE_CLIENT_INFO,
  buildUploadFormData,
  directCreateSignedUrl,
  directSignedUrlWithClient,
  directUploadWithRest,
  normalizeStorageText,
  readStorageResponse,
  retryWithRefreshedSession,
} from "./storage.helpers";
import { isVideoUploadFile, normalizeStorageUploadFile } from "./storage.image";

const DEFAULT_STORAGE_IMAGE_UPLOAD_TIMEOUT_MS = 45_000;
const DEFAULT_STORAGE_VIDEO_UPLOAD_TIMEOUT_MS = 300_000;
const DEFAULT_STORAGE_IMAGE_PREPARE_TIMEOUT_MS = 25_000;
const DEFAULT_STORAGE_VIDEO_PREPARE_TIMEOUT_MS = 240_000;

function normalizeStorageUploadErrorMessage(error: unknown) {
  const rawMessage = String((error as { message?: string } | null)?.message || error || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();
  if (
    normalizedMessage.includes("permission denied") ||
    normalizedMessage.includes("eacces") ||
    normalizedMessage.includes("file not foundexception") ||
    normalizedMessage.includes("open failed")
  ) {
    return "Seçilen medya dosyasına erişilemiyor. Kartı silip medyayı galeriden yeniden seç.";
  }
  return rawMessage;
}

function createStorageTimeoutError(label: string) {
  const error = new Error(`${label} timeout.`) as Error & {
    retryableQueueError?: boolean;
  };
  error.retryableQueueError = true;
  return error;
}

function createStorageAbortError(label: string) {
  const error = new Error(`${label} cancelled.`) as Error & {
    cancelledQueueError?: boolean;
  };
  error.cancelledQueueError = true;
  return error;
}

function throwIfStorageAborted(signal: AbortSignal, label: string) {
  if (signal.aborted) {
    throw createStorageAbortError(label);
  }
}

function withStorageTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
  callerSignal?: AbortSignal,
) {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", handleCallerAbort);
      reject(error);
    };
    const handleCallerAbort = () => {
      controller.abort();
      fail(createStorageAbortError(label));
    };
    const timer = setTimeout(
      () => {
        controller.abort();
        fail(createStorageTimeoutError(label));
      },
      Math.max(1, timeoutMs),
    );
    callerSignal?.addEventListener("abort", handleCallerAbort, { once: true });
    if (callerSignal?.aborted) {
      handleCallerAbort();
      return;
    }

    let operationPromise: Promise<T>;
    try {
      operationPromise = operation(controller.signal);
    } catch (error) {
      fail(error);
      return;
    }

    operationPromise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callerSignal?.removeEventListener("abort", handleCallerAbort);
        resolve(value);
      },
      (error) => {
        fail(error);
      },
    );
  });
}

function toStorageUploadError(error: unknown, fallback: string) {
  const queueError = error as { retryableQueueError?: boolean } | null;
  const message = normalizeStorageUploadErrorMessage(error);
  if (message) {
    const nextError = new Error(message) as Error & {
      retryableQueueError?: boolean;
    };
    if (queueError?.retryableQueueError === true) {
      nextError.retryableQueueError = true;
    }
    return nextError;
  }
  if (error instanceof Error && String(error.message || "").trim()) {
    return error;
  }
  return new Error(fallback);
}

async function prepareStorageUploadFile(
  file: StorageUploadFile,
  folder: StorageFolder,
  options: StorageUploadOptions = {},
) {
  const sourceIsVideo = isVideoUploadFile(file);
  const uploadTimeoutMs =
    options.timeoutMs ||
    (sourceIsVideo
      ? DEFAULT_STORAGE_VIDEO_UPLOAD_TIMEOUT_MS
      : DEFAULT_STORAGE_IMAGE_UPLOAD_TIMEOUT_MS);
  const prepareTimeoutMs = Math.min(
    uploadTimeoutMs,
    sourceIsVideo
      ? DEFAULT_STORAGE_VIDEO_PREPARE_TIMEOUT_MS
      : DEFAULT_STORAGE_IMAGE_PREPARE_TIMEOUT_MS,
  );

  try {
    return await withStorageTimeout(
      async (signal) => {
        throwIfStorageAborted(signal, "Media prepare");
        const prepared = await normalizeStorageUploadFile(file, folder);
        throwIfStorageAborted(signal, "Media prepare");
        return prepared;
      },
      prepareTimeoutMs,
      "Media prepare",
      options.signal,
    );
  } catch (error) {
    throw toStorageUploadError(error, "Dosya yüklenemedi.");
  }
}

async function uploadStorageFile(
  file: StorageUploadFile,
  folder: StorageFolder,
  options: StorageUploadOptions,
  prepare: boolean,
) {
  const context = options.context || `storage/upload:${folder}`;
  let normalizedFile: StorageUploadFile;
  try {
    normalizedFile = prepare ? await prepareStorageUploadFile(file, folder, options) : file;
  } catch (error) {
    throw toStorageUploadError(error, "Dosya yüklenemedi.");
  }

  const normalizedFileIsVideo = isVideoUploadFile(normalizedFile);
  const normalizedUploadTimeoutMs =
    options.timeoutMs ||
    (normalizedFileIsVideo
      ? DEFAULT_STORAGE_VIDEO_UPLOAD_TIMEOUT_MS
      : DEFAULT_STORAGE_IMAGE_UPLOAD_TIMEOUT_MS);

  if (options.sessionTicket || normalizedFileIsVideo) {
    try {
      return await withStorageTimeout(
        (signal) =>
          directUploadWithRest(
            normalizedFile,
            folder,
            context,
            options.accessToken,
            options.uploadKey,
            {
              onProgress: options.onProgress,
              signal,
              sessionTicket: options.sessionTicket,
            },
          ),
        normalizedUploadTimeoutMs,
        "Storage upload",
        options.signal,
      );
    } catch (error) {
      throw toStorageUploadError(error, "Dosya yüklenemedi.");
    }
  }

  let res: Response | null = null;
  let requestError: unknown = null;

  try {
    res = await withStorageTimeout(
      (signal) =>
        retryWithRefreshedSession(
          (token) =>
            fetch(`${BASE_URL}/storage/upload`, {
              method: "POST",
              headers: {
                apikey: SUPABASE_PUBLIC_ANON_KEY,
                Authorization: `Bearer ${token}`,
                "x-client-info": SUPABASE_CLIENT_INFO,
              },
              body: buildUploadFormData(normalizedFile, folder, options.uploadKey),
              signal,
            }),
          context,
          options.accessToken,
        ),
      normalizedUploadTimeoutMs,
      "Storage upload",
      options.signal,
    );
  } catch (error) {
    requestError = error;
  }

  const data = res ? await readStorageResponse<UploadResponse>(res) : null;
  if (!res || !res.ok) {
    if (res?.status === 413 || res?.status === 415) {
      throw new Error("Dosya boyutu veya formatı uygun değil.");
    }
    if (res?.status === 429) {
      throw new Error("Çok fazla yükleme denemesi var. Lütfen daha sonra tekrar deneyin.");
    }

    if (res?.status === 401) {
      throw new Error("Oturumunuzu yenileyip tekrar deneyin.");
    }
    if (requestError) throw toStorageUploadError(requestError, "Dosya yüklenemedi.");
    throw new Error("Dosya yüklenemedi.");
  }

  const uploaded = data as UploadResponse;
  return uploaded.path || uploaded.url || "";
}

export const StorageAPI = {
  prepareUploadFile: prepareStorageUploadFile,

  uploadPreparedFile: (
    file: StorageUploadFile,
    folder: StorageFolder,
    options: StorageUploadOptions = {},
  ) => uploadStorageFile(file, folder, options, false),

  uploadFile: (
    file: StorageUploadFile,
    folder: StorageFolder,
    options: StorageUploadOptions = {},
  ) => uploadStorageFile(file, folder, options, true),

  createUploadSession: async (params: {
    accessToken?: string;
    folder: StorageFolder;
    items: StorageUploadSessionCreateItem[];
    mutationId: string;
  }): Promise<StorageUploadSessionResponse> => {
    const response = await retryWithRefreshedSession(
      (token) =>
        fetch(`${BASE_URL}/storage/upload-session/create`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-client-info": SUPABASE_CLIENT_INFO,
          },
          body: JSON.stringify({
            folder: params.folder,
            items: params.items,
            mutationId: params.mutationId,
          }),
        }),
      "storage/upload-session:create",
      params.accessToken,
    );
    const data = await readStorageResponse<StorageUploadSessionResponse>(response);
    if (!response.ok) {
      throw new Error("Yükleme oturumu oluşturulamadı.");
    }
    const record = data && typeof data === "object" ? (data as StorageUploadSessionResponse) : null;
    const sessionId = normalizeStorageText(record?.sessionId);
    const tickets = Array.isArray(record?.tickets)
      ? record.tickets.map((ticket) => ({
          expectedSizeBytes: Number(ticket.expectedSizeBytes || 0),
          mediaIndex: Number(ticket.mediaIndex),
          path: normalizeStorageText(ticket.path),
          uploadToken: normalizeStorageText(ticket.uploadToken),
          uploadUrl: normalizeStorageText(ticket.uploadUrl),
        }))
      : [];
    const invalidTicket = tickets.some(
      (ticket) =>
        !Number.isInteger(ticket.mediaIndex) ||
        ticket.expectedSizeBytes <= 0 ||
        !ticket.path ||
        !ticket.uploadToken ||
        !ticket.uploadUrl,
    );
    if (!sessionId || invalidTicket || tickets.length !== params.items.length) {
      throw new Error("Yükleme oturumu yanıtı geçersiz.");
    }
    return { sessionId, tickets };
  },

  finalizeUploadSession: async (sessionId: string, accessToken?: string) => {
    const response = await retryWithRefreshedSession(
      (token) =>
        fetch(`${BASE_URL}/storage/upload-session/finalize`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-client-info": SUPABASE_CLIENT_INFO,
          },
          body: JSON.stringify({ sessionId }),
        }),
      "storage/upload-session:finalize",
      accessToken,
    );
    if (!response.ok) {
      throw new Error("Yükleme oturumu tamamlanamadı.");
    }
  },

  cancelUploadSession: async (sessionId: string, accessToken?: string) => {
    const response = await retryWithRefreshedSession(
      (token) =>
        fetch(`${BASE_URL}/storage/upload-session/cancel`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-client-info": SUPABASE_CLIENT_INFO,
          },
          body: JSON.stringify({ sessionId }),
        }),
      "storage/upload-session:cancel",
      accessToken,
    );
    if (!response.ok && response.status !== 404) {
      throw new Error("Yükleme oturumu iptal edilemedi.");
    }
  },

  getSignedUrl: async (path: string): Promise<string> => {
    const context = "storage/signed-url";
    const directPreferredUrl =
      (await directSignedUrlWithClient(path, `${context}:client-first`)) ||
      (await directCreateSignedUrl(path, `${context}:rest-first`));
    if (directPreferredUrl) {
      return directPreferredUrl;
    }

    let res: Response | null = null;
    let requestError: unknown = null;
    try {
      res = await retryWithRefreshedSession(
        (token) =>
          fetch(`${BASE_URL}/storage/signed-url`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_PUBLIC_ANON_KEY,
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              "x-client-info": SUPABASE_CLIENT_INFO,
            },
            body: JSON.stringify({ path }),
          }),
        context,
      );
    } catch (error) {
      requestError = error;
    }

    const data = res ? await readStorageResponse<StorageSignedUrlResponse>(res) : null;
    if (!res || !res.ok) {
      const shouldTryDirectFallback =
        !res ||
        res.status === 401 ||
        res.status === 403 ||
        res.status === 404 ||
        res.status === 429 ||
        res.status >= 500;
      if (shouldTryDirectFallback) {
        const directUrl =
          (await directSignedUrlWithClient(path, `${context}:client-fallback`)) ||
          (await directCreateSignedUrl(path, `${context}:rest-fallback`));
        if (directUrl) {
          return directUrl;
        }
      }

      if (res?.status === 401) {
        throw new Error("Oturumunuzu yenileyip tekrar deneyin.");
      }
      if (res?.status === 403) {
        throw new Error("Bu dosyaya erişemezsiniz.");
      }
      if (res?.status === 429) {
        throw new Error("Çok fazla istek var. Lütfen daha sonra tekrar deneyin.");
      }
      if (requestError instanceof Error) throw requestError;
      throw new Error("Bağlantı alınamadı");
    }

    const resolvedUrl = normalizeStorageText((data as StorageSignedUrlResponse).url);
    if (resolvedUrl) return resolvedUrl;

    const directUrl =
      (await directCreateSignedUrl(path, context)) ||
      (await directSignedUrlWithClient(path, context));
    if (directUrl) return directUrl;

    throw new Error("Bağlantı alınamadı");
  },
};
