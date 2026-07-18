/** Request header construction: authorization header building, client info headers. */
import { SUPABASE_PUBLIC_ANON_KEY } from "../config/publicEnv";

const SUPABASE_CLIENT_INFO = "ogrencisosyalagi-mobile/functions";

export function buildRequestHeaders(headers: HeadersInit | undefined, token: string): Headers {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  requestHeaders.set("apikey", SUPABASE_PUBLIC_ANON_KEY);
  requestHeaders.set("Authorization", `Bearer ${token}`);
  requestHeaders.set("x-client-info", SUPABASE_CLIENT_INFO);
  return requestHeaders;
}
