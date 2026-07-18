import { isHttpRequestError } from "./core.requestHelpers";

export type { ApiError } from "./core.requestHelpers";
export { HttpRequestError, isHttpRequestError } from "./core.requestHelpers";
export { getToken } from "./core.auth";
export { del, get, post, put } from "./core.request";
export { BASE_URL } from "./core.shared";

export function isFunctionUnavailable(error: unknown): boolean {
  if (isHttpRequestError(error)) {
    return error.httpStatus === 404;
  }
  const message = String((error as { message?: string })?.message || error || "");
  return (
    message.includes("Requested function was not found") ||
    message.includes("Could not find the function public.") ||
    message.includes("in the schema cache") ||
    message.includes("NOT_FOUND") ||
    message.includes("HTTP 404") ||
    message.includes("rpc is not a function")
  );
}
