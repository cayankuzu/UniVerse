/** Token management: session retrieval with retry logic, token recovery after auth failure, direct token fallback. */
import { SUPABASE_PUBLIC_ANON_KEY } from "../config/publicEnv";
import { debugLog } from "../../platform/logging/logger";
import { supabase } from "../supabase";
import { getRecoveredAccessToken } from "../supabase/authSession";
import { refreshSupabaseSessionSingleFlight } from "../supabase/sessionRefresh";
import type { TokenOptions } from "./core.requestHelpers";

export async function getToken(options: TokenOptions = {}): Promise<string> {
  const { requireAuth = false, directToken, context = "default", forceAnon = false } = options;
  if (directToken) {
    debugLog("API/AUTH", `Using direct token for ${context}`);
    return directToken;
  }

  if (forceAnon) {
    debugLog("API/AUTH", `Using anon token for ${context}`);
    return SUPABASE_PUBLIC_ANON_KEY;
  }

  if (requireAuth) {
    const recoveredAccessToken = await getRecoveredAccessToken();
    if (recoveredAccessToken) {
      return recoveredAccessToken;
    }
    throw new Error("Oturum anahtarı alınamadı. Lütfen tekrar dene.");
  }

  const sessionResult = await supabase.auth.getSession().catch(() => null);
  const accessToken = sessionResult?.data.session?.access_token || null;
  if (accessToken) {
    return accessToken;
  }

  debugLog("API/AUTH", "Falling back to anon token", { context });
  return SUPABASE_PUBLIC_ANON_KEY;
}

export async function tryRecoverAuthSession(context: string): Promise<string | null> {
  try {
    const { data, error } = await refreshSupabaseSessionSingleFlight();
    if (error) {
      debugLog("API/AUTH", "Session refresh failed", {
        context,
        message: error.message,
      });
      return null;
    }
    const accessToken = data.session?.access_token || null;
    const hasToken = Boolean(accessToken);
    debugLog("API/AUTH", "Session refresh result", { context, hasToken });
    return accessToken;
  } catch (error) {
    debugLog("API/AUTH", "Session refresh threw", {
      context,
      message: String((error as { message?: string })?.message || error || ""),
    });
    return null;
  }
}
