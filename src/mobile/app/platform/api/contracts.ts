export const STORAGE_FOLDERS = ["albums", "avatars", "covers", "events", "profiles"] as const;

export type StorageFolder = (typeof STORAGE_FOLDERS)[number];

export interface UploadResponse {
  path: string;
  url: string;
  expiresAt?: string;
}

export interface StorageSignedUrlResponse {
  url: string;
  expiresAt?: string;
}

export interface StorageUploadFile {
  uri: string;
  name?: string;
  type?: string;
}

export interface StorageUploadSessionTicket {
  expectedSizeBytes: number;
  mediaIndex: number;
  path: string;
  uploadToken: string;
  uploadUrl: string;
}

export interface StorageUploadSessionCreateItem {
  checksum: string;
  contentType: string;
  expectedSizeBytes: number;
  mediaIndex: number;
  sourceName: string;
}

export interface StorageUploadSessionResponse {
  sessionId: string;
  tickets: StorageUploadSessionTicket[];
}

export interface StorageUploadOptions {
  accessToken?: string;
  context?: string;
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
  sessionTicket?: StorageUploadSessionTicket;
  timeoutMs?: number;
  uploadKey?: string;
}
