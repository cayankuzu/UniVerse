import AsyncStorage from "@react-native-async-storage/async-storage";
import { File as ExpoFile } from "expo-file-system";
import { Upload } from "tus-js-client";
import type { StorageUploadFile, StorageUploadSessionTicket } from "../../platform/api/contracts";
import {
  SUPABASE_PUBLIC_ANON_KEY,
  SUPABASE_PUBLIC_URL_VALIDATED,
} from "../../platform/config/publicEnv";
import { SUPABASE_PROJECT_ID } from "../../platform/config/supabasePublic";
import { STORAGE_BUCKET } from "./storage.helpers.shared";

export const RESUMABLE_UPLOAD_MIN_BYTES = 6 * 1024 * 1024;
const RESUMABLE_UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;
const TUS_STORAGE_PREFIX = "universe:tus-upload:";

type StoredTusUpload = {
  creationTime: string;
  metadata: Record<string, string>;
  parallelUploadUrls: string[] | null;
  size: number | null;
  uploadUrl: string | null;
  urlStorageKey: string;
};

function buildTusStorageKey(fingerprint: string) {
  return `${TUS_STORAGE_PREFIX}${encodeURIComponent(fingerprint)}`;
}

const asyncTusUrlStorage = {
  async addUpload(fingerprint: string, upload: StoredTusUpload) {
    const storageKey = buildTusStorageKey(fingerprint);
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({ ...upload, urlStorageKey: storageKey }),
    );
    return storageKey;
  },
  async findAllUploads() {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(TUS_STORAGE_PREFIX),
    );
    if (keys.length === 0) return [];
    const entries = await AsyncStorage.multiGet(keys);
    return entries.flatMap(([storageKey, raw]) => {
      if (!raw) return [];
      try {
        return [{ ...(JSON.parse(raw) as StoredTusUpload), urlStorageKey: storageKey }];
      } catch {
        void AsyncStorage.removeItem(storageKey);
        return [];
      }
    });
  },
  async findUploadsByFingerprint(fingerprint: string) {
    const storageKey = buildTusStorageKey(fingerprint);
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      return [{ ...(JSON.parse(raw) as StoredTusUpload), urlStorageKey: storageKey }];
    } catch {
      await AsyncStorage.removeItem(storageKey);
      return [];
    }
  },
  async removeUpload(storageKey: string) {
    await AsyncStorage.removeItem(storageKey);
  },
};

function createExpoTusFileReader() {
  const activeHandles = new Set<ReturnType<ExpoFile["open"]>>();
  return {
    closeAll() {
      activeHandles.forEach((handle) => handle.close());
      activeHandles.clear();
    },
    async openFile(input: { uri?: string }) {
      const uri = String(input?.uri || "").trim();
      const file = new ExpoFile(uri);
      if (!uri || !file.exists || file.size <= 0) {
        throw new Error("Resumable upload medya dosyasi okunamadi.");
      }
      const handle = file.open();
      activeHandles.add(handle);
      let closed = false;
      return {
        close() {
          if (closed) return;
          closed = true;
          activeHandles.delete(handle);
          handle.close();
        },
        size: file.size,
        async slice(start: number, end: number) {
          handle.offset = start;
          const bytes = handle.readBytes(Math.max(0, Math.min(file.size, end) - start));
          return {
            done: start + bytes.length >= file.size,
            value: bytes.length ? new Blob([bytes]) : null,
          };
        },
      };
    },
  };
}

function resolveTusEndpoint() {
  if (SUPABASE_PROJECT_ID) {
    return `https://${SUPABASE_PROJECT_ID}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${SUPABASE_PUBLIC_URL_VALIDATED}/storage/v1/upload/resumable`;
}

function createResumableAbortError() {
  const error = new Error("Upload cancelled.");
  error.name = "AbortError";
  return error;
}

export function uploadFileResumably(params: {
  accessToken: string;
  contentType: string;
  file: StorageUploadFile;
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
  ticket: StorageUploadSessionTicket;
  uploadKey: string;
}) {
  const accessToken = String(params.accessToken || "").trim();
  const uploadToken = String(params.ticket.uploadToken || "").trim();
  if (!accessToken || !uploadToken) {
    return Promise.reject(new Error("Resumable upload yetkilendirmesi eksik."));
  }
  const fingerprint = [STORAGE_BUCKET, params.ticket.path, params.uploadKey].join(":");
  const fileReader = createExpoTusFileReader();

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const settle = (error?: unknown) => {
      if (settled) return;
      settled = true;
      params.signal?.removeEventListener("abort", handleAbort);
      fileReader.closeAll();
      if (error) reject(error);
      else resolve(params.ticket.path);
    };
    const upload = new Upload(
      {
        name: params.file.name,
        type: params.contentType,
        uri: params.file.uri,
      } as unknown as File,
      {
        chunkSize: RESUMABLE_UPLOAD_CHUNK_BYTES,
        endpoint: resolveTusEndpoint(),
        fileReader,
        fingerprint: async () => fingerprint,
        headers: {
          apikey: SUPABASE_PUBLIC_ANON_KEY,
          authorization: `Bearer ${accessToken}`,
          "x-signature": uploadToken,
          "x-upsert": "true",
        },
        metadata: {
          bucketName: STORAGE_BUCKET,
          cacheControl: "3600",
          contentType: params.contentType,
          objectName: params.ticket.path,
        },
        onError: (error) => settle(error),
        onProgress: (sentBytes, totalBytes) => params.onProgress?.(sentBytes, totalBytes),
        onSuccess: () => settle(),
        removeFingerprintOnSuccess: true,
        retryDelays: [0, 1_000, 3_000, 5_000, 10_000, 20_000],
        storeFingerprintForResuming: true,
        uploadDataDuringCreation: true,
        uploadSize: params.ticket.expectedSizeBytes,
        urlStorage: asyncTusUrlStorage,
      },
    );
    const handleAbort = () => {
      void upload.abort(false).finally(() => settle(createResumableAbortError()));
    };
    params.signal?.addEventListener("abort", handleAbort, { once: true });
    if (params.signal?.aborted) {
      handleAbort();
      return;
    }
    void upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads[0]) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch(settle);
  });
}
