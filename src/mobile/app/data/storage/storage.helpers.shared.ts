import { getToken, type ApiError } from "../../platform/api/core";
import { supabase } from "../../platform/supabase";
import { recoverAuthState } from "../../platform/supabase/authSession";
import { refreshSupabaseSessionSingleFlight } from "../../platform/supabase/sessionRefresh";

export const SUPABASE_CLIENT_INFO = "ogrencisosyalagi-mobile/functions";
export const STORAGE_BUCKET = "make-e3557d40-media";
export const STORAGE_SIGNED_URL_TTL_SECONDS = 60 * 10;
export const CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type StorageSession = {
  access_token: string;
  user: {
    id: string;
  };
};

export async function readStorageResponse<T>(res: Response): Promise<T | ApiError | string | null> {
  const rawBody = await res.text().catch(() => "");
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody) as T | ApiError;
  } catch {
    return rawBody;
  }
}

async function getFreshStorageToken(params: {
  context: string;
  directToken?: string;
  requireAuth?: boolean;
}) {
  return getToken({
    context: params.context,
    directToken: params.directToken,
    requireAuth: params.requireAuth ?? true,
  });
}

export async function retryWithRefreshedSession(
  request: (token: string) => Promise<Response>,
  context: string,
  directToken?: string,
) {
  const initialToken = await getFreshStorageToken({
    context,
    directToken,
    requireAuth: true,
  });
  let response = await request(initialToken);
  if (response.status !== 401) {
    return response;
  }

  const refresh = await refreshSupabaseSessionSingleFlight().catch(() => null);
  const refreshedToken = refresh?.data.session?.access_token || null;
  if (!refreshedToken) {
    return response;
  }

  response = await request(refreshedToken);
  return response;
}

export function normalizeStorageText(value: unknown) {
  return String(value || "").trim();
}

export function encodeStorageObjectPath(path: string) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function extractStorageErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") return payload.trim() || fallback;
  if (payload && typeof payload === "object") {
    const record = payload as { error?: unknown; message?: unknown };
    const message = normalizeStorageText(record.error || record.message);
    if (message) return message;
  }
  return fallback;
}

const STORAGE_REMOTE_ERROR_FLAG = "__isStorageRemoteError";

/**
 * Marks an error as originating from a remote call (signed-upload ticket
 * request or the binary upload HTTP response), as opposed to a local
 * file-system access failure. Callers further up the stack (e.g. the album
 * upload queue) use this to avoid misclassifying genuine server/auth errors
 * as "can't read this file from the gallery" issues.
 */
export function markStorageRemoteError<T extends Error>(error: T): T {
  (error as unknown as Record<string, unknown>)[STORAGE_REMOTE_ERROR_FLAG] = true;
  return error;
}

export function isStorageRemoteError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (error as Record<string, unknown>)[STORAGE_REMOTE_ERROR_FLAG],
  );
}

export async function getCurrentStorageSession(context: string): Promise<StorageSession> {
  const authState = await recoverAuthState();
  if (authState.accessToken && authState.user?.id) {
    return {
      access_token: authState.accessToken,
      user: {
        id: authState.user.id,
      },
    };
  }

  throw new Error(`Storage session unavailable for ${context}`);
}

export async function resolveDirectStorageIdentity(context: string, directToken?: string) {
  if (directToken) {
    const directUserResult = await supabase.auth.getUser(directToken).catch(() => null);
    const directUser = directUserResult?.data.user || null;
    if (directUser?.id) {
      return {
        accessToken: directToken,
        userId: directUser.id,
      };
    }
  }

  const session = await getCurrentStorageSession(`${context}:fallback-session`);
  return {
    accessToken: session.access_token,
    userId: session.user.id,
  };
}
