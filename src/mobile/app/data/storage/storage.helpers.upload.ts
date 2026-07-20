import {
  FileSystemUploadType,
  cacheDirectory,
  copyAsync,
  createUploadTask,
  deleteAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import { BASE_URL } from "../../platform/api/core";
import { SUPABASE_PUBLIC_ANON_KEY, SUPABASE_PUBLIC_URL } from "../../platform/config/publicEnv";
import { RUNTIME_FLAGS } from "../../platform/config/runtime";
import type {
  StorageFolder,
  StorageUploadFile,
  StorageUploadSessionTicket,
} from "../../platform/api/contracts";
import { refreshSupabaseSessionSingleFlight } from "../../platform/supabase/sessionRefresh";
import {
  encodeStorageObjectPath,
  extractStorageErrorMessage,
  markStorageRemoteError,
  normalizeStorageText,
  readStorageResponse,
  resolveDirectStorageIdentity,
  retryWithRefreshedSession,
  SUPABASE_CLIENT_INFO,
  STORAGE_BUCKET,
} from "./storage.helpers.shared";
import { RESUMABLE_UPLOAD_MIN_BYTES, uploadFileResumably } from "./storage.resumableUpload";

const keepOriginalUploadFile: () => Promise<void> = async () => undefined;

function sanitizeExtension(rawExtension: string) {
  return normalizeStorageText(rawExtension)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function sanitizeSourceName(value: string) {
  const normalized = normalizeStorageText(value);
  if (!normalized) return "upload";
  const withoutExtension = normalized.replace(/\.[^.]+$/, "");
  const compact = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return compact || "upload";
}

async function prepareUploadableLocalUri(sourceUri: string, objectPath: string) {
  const normalizedUri = normalizeStorageText(sourceUri);
  if (/^file:\/\//i.test(normalizedUri)) {
    return {
      cleanup: keepOriginalUploadFile,
      localUri: normalizedUri,
    };
  }

  const baseCacheDirectory = normalizeStorageText(cacheDirectory);
  if (!baseCacheDirectory) {
    throw new Error("Yerel dosya okunamadi.");
  }

  const tempDirectory = `${baseCacheDirectory.replace(/\/?$/, "/")}storage-upload-cache/`;
  await makeDirectoryAsync(tempDirectory, { intermediates: true }).catch(() => null);
  const fileName =
    objectPath.split("/").filter(Boolean).pop() || `upload-${Date.now().toString(36)}.jpg`;
  const localUri = `${tempDirectory}${fileName}`;
  await copyAsync({
    from: normalizedUri,
    to: localUri,
  });
  return {
    cleanup: async () => {
      await deleteAsync(localUri, { idempotent: true }).catch(() => null);
    },
    localUri,
  };
}

function normalizeUploadKey(value: string | undefined) {
  const normalized = normalizeStorageText(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return normalized || "";
}

function isDirectStorageUploadFallbackEnabled() {
  return RUNTIME_FLAGS.allowDirectStorageUploadFallback;
}

export function buildUploadFormData(
  file: StorageUploadFile,
  folder: StorageFolder,
  uploadKey?: string,
) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name || `upload-${Date.now()}.jpg`,
    type: file.type || "image/jpeg",
  } as unknown as Blob);
  formData.append("folder", folder);
  if (normalizeUploadKey(uploadKey)) {
    formData.append("uploadKey", normalizeUploadKey(uploadKey));
  }
  return formData;
}

async function uploadBinaryContent(params: {
  contentType: string;
  localUri: string;
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
  signedUploadUrl: string;
}) {
  throwIfUploadAborted(params.signal);
  const uploadOptions = {
    headers: {
      "Content-Type": params.contentType,
    },
    httpMethod: "PUT" as const,
    uploadType: FileSystemUploadType.BINARY_CONTENT,
  };
  const uploadTask = params.onProgress
    ? createUploadTask(params.signedUploadUrl, params.localUri, uploadOptions, (progress) => {
        params.onProgress?.(progress.totalBytesSent, progress.totalBytesExpectedToSend);
      })
    : createUploadTask(params.signedUploadUrl, params.localUri, uploadOptions);
  let cancelRequested = false;
  let cancelPromise: Promise<unknown> | null = null;
  const cancelUpload = () => {
    if (cancelRequested) return;
    cancelRequested = true;
    cancelPromise = uploadTask.cancelAsync().catch(() => null);
  };
  const handleAbort = () => {
    cancelUpload();
  };

  params.signal?.addEventListener("abort", handleAbort, { once: true });
  try {
    if (params.signal?.aborted) {
      cancelUpload();
      throwIfUploadAborted(params.signal);
    }
    const response = await uploadTask.uploadAsync();
    throwIfUploadAborted(params.signal);
    if (!response) {
      throw new Error("Upload cancelled.");
    }
    return response;
  } catch (error) {
    throwIfUploadAborted(params.signal);
    throw error;
  } finally {
    params.signal?.removeEventListener("abort", handleAbort);
    if (cancelPromise) {
      await cancelPromise;
    }
  }
}

type StorageUploadTicketResponse = {
  path?: unknown;
  uploadUrl?: unknown;
  url?: unknown;
};

type StorageUploadConfirmResponse = {
  path?: unknown;
};

type DirectUploadOptions = {
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  sessionTicket?: StorageUploadSessionTicket;
  signal?: AbortSignal;
  signedUpload?: {
    objectPath: string;
    signedUploadUrl: string;
  };
};

function throwIfUploadAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Upload cancelled.");
  }
}

function normalizeSignedUploadUrl(value: string) {
  const signedUploadUrl = normalizeStorageText(value);
  if (!signedUploadUrl) {
    throw markStorageRemoteError(new Error("Upload URL alinamadi."));
  }
  if (/^https?:\/\//i.test(signedUploadUrl)) {
    return signedUploadUrl;
  }
  return `${SUPABASE_PUBLIC_URL}/storage/v1${
    signedUploadUrl.startsWith("/") ? signedUploadUrl : `/${signedUploadUrl}`
  }`;
}

function buildDirectUploadPath(params: {
  contentType: string;
  folder: StorageFolder;
  sourceName: string;
  uploadKey?: string;
  userId: string;
}) {
  const sourceExtension = sanitizeExtension(params.sourceName.split(".").pop() || "");
  const fallbackExtension = params.contentType.startsWith("video/") ? "mp4" : "jpg";
  const extension = sourceExtension || fallbackExtension;
  const normalizedUploadKey = normalizeUploadKey(params.uploadKey);
  const objectStem = normalizedUploadKey
    ? sanitizeSourceName(normalizedUploadKey)
    : `${sanitizeSourceName(params.sourceName)}-${Date.now().toString(36)}`;
  return `${params.folder}/${params.userId}/${objectStem}.${extension}`;
}

async function requestSignedUploadTicketWithStorageRest(params: {
  contentType: string;
  context: string;
  directToken?: string;
  folder: StorageFolder;
  signal?: AbortSignal;
  sourceName: string;
  uploadKey?: string;
}) {
  throwIfUploadAborted(params.signal);
  const identity = await resolveDirectStorageIdentity(
    `${params.context}:upload-ticket-direct`,
    params.directToken,
  );
  const objectPath = buildDirectUploadPath({
    contentType: params.contentType,
    folder: params.folder,
    sourceName: params.sourceName,
    uploadKey: params.uploadKey,
    userId: identity.userId,
  });
  const response = await retryWithRefreshedSession(
    (token) =>
      fetch(
        `${SUPABASE_PUBLIC_URL}/storage/v1/object/upload/sign/${STORAGE_BUCKET}/${encodeStorageObjectPath(objectPath)}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_PUBLIC_ANON_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(params.uploadKey ? { "x-upsert": "true" } : {}),
          },
          body: "{}",
          signal: params.signal,
        },
      ),
    `${params.context}:upload-ticket-direct`,
    identity.accessToken,
  );
  throwIfUploadAborted(params.signal);
  const payload = await readStorageResponse<StorageUploadTicketResponse>(response);
  if (!response.ok) {
    throw markStorageRemoteError(
      new Error(extractStorageErrorMessage(payload, `Upload URL alinamadi (${response.status}).`)),
    );
  }

  const record =
    payload && typeof payload === "object" ? (payload as StorageUploadTicketResponse) : null;
  const rawSignedUploadUrl = normalizeStorageText(record?.uploadUrl || record?.url);
  if (!rawSignedUploadUrl) {
    throw markStorageRemoteError(new Error("Upload URL alinamadi."));
  }
  const signedUploadUrl = normalizeSignedUploadUrl(rawSignedUploadUrl);

  return {
    objectPath,
    signedUploadUrl,
  };
}

async function requestSignedUploadTicket(params: {
  contentType: string;
  context: string;
  directToken?: string;
  folder: StorageFolder;
  signal?: AbortSignal;
  sourceName: string;
  uploadKey?: string;
}) {
  throwIfUploadAborted(params.signal);
  const response = await retryWithRefreshedSession(
    (token) =>
      fetch(`${BASE_URL}/storage/upload-ticket`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLIC_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-client-info": SUPABASE_CLIENT_INFO,
        },
        body: JSON.stringify({
          contentType: params.contentType,
          folder: params.folder,
          sourceName: params.sourceName,
          uploadKey: params.uploadKey || undefined,
        }),
        signal: params.signal,
      }),
    `${params.context}:upload-ticket`,
    params.directToken,
  );
  throwIfUploadAborted(params.signal);
  const payload = await readStorageResponse<StorageUploadTicketResponse>(response);
  if (response.status === 404) {
    if (isDirectStorageUploadFallbackEnabled()) {
      return requestSignedUploadTicketWithStorageRest(params);
    }
    throw markStorageRemoteError(new Error("Upload broker kullanilamiyor."));
  }
  if (!response.ok) {
    throw markStorageRemoteError(
      new Error(extractStorageErrorMessage(payload, `Upload URL alinamadi (${response.status}).`)),
    );
  }

  const record =
    payload && typeof payload === "object" ? (payload as StorageUploadTicketResponse) : null;
  const objectPath = normalizeStorageText(record?.path);
  const signedUploadUrl = normalizeStorageText(record?.uploadUrl);
  if (!objectPath || !signedUploadUrl) {
    throw markStorageRemoteError(new Error("Upload URL alinamadi."));
  }

  return {
    objectPath,
    signedUploadUrl,
  };
}

async function confirmSignedUpload(params: {
  contentType: string;
  context: string;
  directToken?: string;
  objectPath: string;
  signal?: AbortSignal;
}) {
  throwIfUploadAborted(params.signal);
  const response = await retryWithRefreshedSession(
    (token) =>
      fetch(`${BASE_URL}/storage/upload-confirm`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLIC_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-client-info": SUPABASE_CLIENT_INFO,
        },
        body: JSON.stringify({
          contentType: params.contentType,
          path: params.objectPath,
        }),
        signal: params.signal,
      }),
    `${params.context}:upload-confirm`,
    params.directToken,
  );
  throwIfUploadAborted(params.signal);
  const payload = await readStorageResponse<StorageUploadConfirmResponse>(response);
  if (!response.ok) {
    throw markStorageRemoteError(
      new Error(extractStorageErrorMessage(payload, `Upload dogrulanamadi (${response.status}).`)),
    );
  }

  const confirmedPath = normalizeStorageText(
    payload && typeof payload === "object" ? (payload as StorageUploadConfirmResponse).path : "",
  );
  if (!confirmedPath || confirmedPath !== params.objectPath) {
    throw markStorageRemoteError(new Error("Upload dogrulanamadi."));
  }
}

export async function directUploadWithRest(
  file: StorageUploadFile,
  folder: StorageFolder,
  context: string,
  directToken?: string,
  uploadKey?: string,
  options: DirectUploadOptions = {},
): Promise<string> {
  const performUpload = async (accessTokenOverride?: string) => {
    const effectiveToken = accessTokenOverride || directToken;
    const contentType =
      normalizeStorageText(file.type || "image/jpeg").toLowerCase() || "image/jpeg";
    const normalizedUploadKey = normalizeUploadKey(uploadKey);
    const sourceName = normalizeStorageText(file.name) || `upload-${Date.now().toString(36)}`;
    const ticket = options.sessionTicket
      ? {
          objectPath: options.sessionTicket.path,
          signedUploadUrl: options.sessionTicket.uploadUrl,
        }
      : options.signedUpload
        ? options.signedUpload
        : await requestSignedUploadTicket({
            contentType,
            context,
            directToken: effectiveToken,
            folder,
            signal: options.signal,
            sourceName,
            uploadKey: normalizedUploadKey,
          });
    throwIfUploadAborted(options.signal);
    const preparedFile = await prepareUploadableLocalUri(file.uri, ticket.objectPath);
    const signedUploadUrl = normalizeSignedUploadUrl(ticket.signedUploadUrl);

    try {
      if (
        options.sessionTicket &&
        options.sessionTicket.expectedSizeBytes > RESUMABLE_UPLOAD_MIN_BYTES
      ) {
        await uploadFileResumably({
          accessToken: normalizeStorageText(effectiveToken),
          contentType,
          file: { ...file, uri: preparedFile.localUri },
          onProgress: options.onProgress,
          signal: options.signal,
          ticket: options.sessionTicket,
          uploadKey: normalizedUploadKey || options.sessionTicket.path,
        });
      } else {
        const response = await uploadBinaryContent({
          contentType,
          localUri: preparedFile.localUri,
          onProgress: options.onProgress,
          signal: options.signal,
          signedUploadUrl,
        });
        if (response.status < 200 || response.status >= 300) {
          let payload: unknown = null;
          try {
            payload = response.body ? JSON.parse(response.body) : null;
          } catch {
            payload = response.body || null;
          }
          throw markStorageRemoteError(
            new Error(
              extractStorageErrorMessage(payload, `Dosya yuklenemedi (${response.status}).`),
            ),
          );
        }
      }
    } finally {
      await preparedFile.cleanup();
    }
    throwIfUploadAborted(options.signal);

    await confirmSignedUpload({
      contentType,
      context,
      directToken: effectiveToken,
      objectPath: ticket.objectPath,
      signal: options.signal,
    });

    return ticket.objectPath;
  };

  try {
    return await performUpload();
  } catch (error) {
    const message = normalizeStorageText(
      (error as { message?: string } | null)?.message || error,
    ).toLowerCase();
    const shouldRetryWithFreshSession =
      message.includes("unauthorized") ||
      message.includes("invalid jwt") ||
      message.includes("auth session missing") ||
      message.includes("oturum");
    if (!shouldRetryWithFreshSession) {
      throw error;
    }

    const refreshResult = await refreshSupabaseSessionSingleFlight().catch(() => null);
    const refreshedToken = normalizeStorageText(refreshResult?.data.session?.access_token);
    if (!refreshedToken || refreshedToken === normalizeStorageText(directToken)) {
      throw error;
    }

    return performUpload(refreshedToken);
  }
}
