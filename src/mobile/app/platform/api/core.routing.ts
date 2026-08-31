import { CLOUDFLARE_GATEWAY_URL } from "../config/publicEnv";
import { BASE_URL } from "./core.shared";

const CLOUDFLARE_POST_ROUTES = new Set([
  "/auth/register-direct",
  "/auth/register",
  "/reports",
  "/storage/upload-session/create",
  "/storage/upload-session/finalize",
  "/storage/upload-session/cancel",
]);

function pathWithoutQuery(path: string) {
  return path.split("?", 1)[0] || "/";
}

export function isCloudflareGatewayRoute(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  const pathname = pathWithoutQuery(path);

  if (normalizedMethod === "POST") {
    return CLOUDFLARE_POST_ROUTES.has(pathname);
  }
  if (normalizedMethod !== "GET") return false;

  return (
    pathname === "/health" ||
    pathname === "/auth/check-email" ||
    /^\/auth\/check-username\/[a-z0-9_]{3,24}$/.test(pathname)
  );
}

export function resolveApiUrl(method: string, path: string) {
  const baseUrl =
    CLOUDFLARE_GATEWAY_URL && isCloudflareGatewayRoute(method, path)
      ? CLOUDFLARE_GATEWAY_URL
      : BASE_URL;
  return `${baseUrl}${path}`;
}
