function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const directStatus = Number((error as { status?: number }).status || 0);
  if (Number.isFinite(directStatus) && directStatus > 0) return directStatus;
  const responseStatus = Number(
    (error as { response?: { status?: number } }).response?.status || 0,
  );
  if (Number.isFinite(responseStatus) && responseStatus > 0) return responseStatus;
  return null;
}

function getErrorMessage(error: unknown) {
  return String((error as { message?: string } | null)?.message || error || "")
    .trim()
    .toLowerCase();
}

export function isRetryableQueryError(error: unknown) {
  const status = getErrorStatus(error);
  if (status === 408 || status === 425 || status === 429) return true;
  if (status !== null) {
    if (status >= 500) return true;
    if (status >= 400) return false;
  }

  const message = getErrorMessage(error);
  if (!message) return true;
  return (
    message.includes("network request failed") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("socket") ||
    message.includes("connection") ||
    message.includes("offline")
  );
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
  return failureCount < 2 && isRetryableQueryError(error);
}

export function getQueryRetryDelay(attempt: number) {
  const exponentialDelay = Math.min(600 * 2 ** attempt, 2_500);
  const jitterMultiplier = 0.75 + Math.random() * 0.5;
  return Math.round(exponentialDelay * jitterMultiplier);
}
