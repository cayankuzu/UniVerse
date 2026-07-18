import { createClient } from "npm:@supabase/supabase-js";
import { publicAnonKey } from "../../../../utils/supabase/info.tsx";

type HeaderReader = {
  req: {
    header(name: string): string | undefined;
  };
};

function getSupabaseUrl() {
  const value = String(Deno.env.get("SUPABASE_URL") || "").trim();
  if (!value) {
    throw new Error("[viewer-supabase] Missing SUPABASE_URL");
  }
  return value;
}

function getSupabaseAnonKey() {
  return String(
    Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("ANON_KEY") ||
      Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
      publicAnonKey,
  ).trim();
}

export function getRequestBearerToken(c: HeaderReader) {
  const authorization = String(c.req.header("Authorization") || "").trim();
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return authorization.slice(7).trim();
}

export function createViewerSupabaseClient(c: HeaderReader) {
  const accessToken = getRequestBearerToken(c);
  if (!accessToken) return null;
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
