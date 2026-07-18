import { STORAGE_BUCKET } from "./storagePolicy.ts";

const DEFAULT_MEDIA_SCAN_TIMEOUT_MS = 12_000;
const MIN_MEDIA_SCAN_TIMEOUT_MS = 2_000;
const MAX_MEDIA_SCAN_TIMEOUT_MS = 30_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export type MediaScanResult = {
  checksumSha256: string | null;
  contentType: string | null;
  provider: string;
  raw: Record<string, unknown>;
  reason: string | null;
  sizeBytes: number | null;
  verdict: "failed" | "passed";
};

export class MediaScanError extends Error {
  readonly status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "MediaScanError";
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function resolveMediaScanTimeoutMs() {
  const configured = Number(Deno.env.get("MEDIA_SCAN_TIMEOUT_MS") || 0);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MEDIA_SCAN_TIMEOUT_MS;
  return Math.min(MAX_MEDIA_SCAN_TIMEOUT_MS, Math.max(MIN_MEDIA_SCAN_TIMEOUT_MS, configured));
}

function getRequiredMediaScanConfig() {
  const webhookToken = normalizeText(Deno.env.get("MEDIA_SCAN_WEBHOOK_TOKEN"));
  const webhookUrl = normalizeText(Deno.env.get("MEDIA_SCAN_WEBHOOK_URL"));
  if (!webhookUrl || !webhookToken) {
    throw new MediaScanError("Medya guvenlik tarayicisi yapilandirilmadi.");
  }
  return { webhookToken, webhookUrl };
}

export function isMediaScannerConfigured() {
  try {
    getRequiredMediaScanConfig();
    return true;
  } catch {
    return false;
  }
}

function parseMediaScanResult(value: unknown): MediaScanResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MediaScanError("Medya tarama yaniti gecersiz.");
  }
  const raw = value as Record<string, unknown>;
  const verdict = normalizeText(raw.verdict).toLowerCase();
  if (verdict !== "passed" && verdict !== "failed") {
    throw new MediaScanError("Medya tarama karari eksik.");
  }
  const provider = normalizeText(raw.provider);
  if (!provider) {
    throw new MediaScanError("Medya tarama saglayicisi eksik.");
  }
  const checksumSha256 = normalizeText(raw.checksumSha256 || raw.checksum).toLowerCase();
  const contentType = normalizeText(raw.contentType).toLowerCase();
  const sizeBytes = Number(raw.sizeBytes || 0);
  if (
    verdict === "passed" &&
    (!SHA256_PATTERN.test(checksumSha256) ||
      !contentType ||
      !Number.isFinite(sizeBytes) ||
      sizeBytes <= 0)
  ) {
    throw new MediaScanError("Basarili medya tarama kaniti eksik.");
  }
  return {
    checksumSha256: checksumSha256 || null,
    contentType: contentType || null,
    provider,
    raw,
    reason: normalizeText(raw.reason) || null,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : null,
    verdict,
  };
}

export async function triggerMediaScanHook(params: {
  contentType: string;
  objectPath: string;
  ownerId: string;
  sizeBytes: number;
}): Promise<MediaScanResult> {
  const { webhookToken, webhookUrl } = getRequiredMediaScanConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveMediaScanTimeoutMs());
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { "x-media-scan-token": webhookToken } : {}),
      },
      body: JSON.stringify({
        bucket: STORAGE_BUCKET,
        contentType: params.contentType,
        objectPath: params.objectPath,
        ownerId: params.ownerId,
        sizeBytes: params.sizeBytes,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new MediaScanError(`Medya tarama servisi ${response.status} dondu.`);
    }
    return parseMediaScanResult(await response.json().catch(() => null));
  } catch (error) {
    if (error instanceof MediaScanError) throw error;
    if (controller.signal.aborted) {
      throw new MediaScanError("Medya guvenlik taramasi zaman asimina ugradi.");
    }
    throw new MediaScanError("Medya guvenlik taramasi tamamlanamadi.");
  } finally {
    clearTimeout(timeout);
  }
}
