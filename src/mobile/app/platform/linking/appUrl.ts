import { APP_SCHEME } from "../config/runtime";

function normalizePath(path?: string) {
  const value = String(path || "").trim();
  if (!value || value === "/") return "";
  return value.replace(/^\/+/, "");
}

export function buildAppUrl(path?: string) {
  const normalizedPath = normalizePath(path);
  return normalizedPath ? `${APP_SCHEME}://${normalizedPath}` : `${APP_SCHEME}://`;
}
