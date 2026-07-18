import { SUPABASE_PUBLIC_ANON_KEY, SUPABASE_PUBLIC_URL } from "../../platform/config/publicEnv";
import { supabase } from "../../platform/supabase";
import {
  encodeStorageObjectPath,
  getCurrentStorageSession,
  normalizeStorageText,
  readStorageResponse,
  resolveDirectStorageIdentity,
  STORAGE_BUCKET,
  STORAGE_SIGNED_URL_TTL_SECONDS,
} from "./storage.helpers.shared";

export async function directSignedUrlWithClient(
  path: string,
  context: string,
): Promise<string | null> {
  const session = await getCurrentStorageSession(`${context}:direct-signed-url`).catch(() => null);
  if (!session?.user?.id) return null;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, STORAGE_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

export async function directCreateSignedUrl(path: string, context: string): Promise<string | null> {
  const identity = await resolveDirectStorageIdentity(`${context}:direct-signed-url`).catch(
    () => null,
  );
  if (!identity?.userId) return null;

  const response = await fetch(
    `${SUPABASE_PUBLIC_URL}/storage/v1/object/sign/${STORAGE_BUCKET}/${encodeStorageObjectPath(path)}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLIC_ANON_KEY,
        Authorization: `Bearer ${identity.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS }),
    },
  ).catch(() => null);

  if (!response?.ok) return null;
  const payload = await readStorageResponse<{ signedURL?: string; signedUrl?: string }>(response);
  if (!payload || typeof payload !== "object") return null;

  const record = payload as { signedURL?: unknown; signedUrl?: unknown };
  const signedPath = normalizeStorageText(record.signedURL || record.signedUrl);
  if (!signedPath) return null;
  if (/^https?:/i.test(signedPath)) return signedPath;
  return `${SUPABASE_PUBLIC_URL}/storage/v1${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;
}
