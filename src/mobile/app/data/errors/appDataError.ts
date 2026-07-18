export type AppDataErrorCode = "forbidden" | "invalid_state" | "network" | "not_found" | "unknown";

type AppDataErrorMeta = Record<string, unknown>;

export class AppDataError extends Error {
  readonly cause?: unknown;
  readonly code: AppDataErrorCode;
  readonly meta?: AppDataErrorMeta;

  constructor(params: {
    cause?: unknown;
    code: AppDataErrorCode;
    message: string;
    meta?: AppDataErrorMeta;
  }) {
    super(params.message);
    this.name = "AppDataError";
    this.code = params.code;
    this.cause = params.cause;
    this.meta = params.meta;
  }
}

function inferAppDataErrorCode(error: { message?: string; status?: number }): AppDataErrorCode {
  const status = Number(error.status || 0);
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "network";

  const normalizedMessage = String(error.message || "")
    .trim()
    .toLowerCase();
  if (!normalizedMessage) return "unknown";
  if (
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("bulunamadi") ||
    normalizedMessage.includes("bulunamadı")
  ) {
    return "not_found";
  }
  if (
    normalizedMessage.includes("forbidden") ||
    normalizedMessage.includes("not visible") ||
    normalizedMessage.includes("yetkiniz") ||
    normalizedMessage.includes("permission")
  ) {
    return "forbidden";
  }
  if (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("offline")
  ) {
    return "network";
  }
  if (normalizedMessage.includes("invalid") || normalizedMessage.includes("state")) {
    return "invalid_state";
  }
  return "unknown";
}

export function toAppDataError(
  error: unknown,
  fallback: {
    code?: AppDataErrorCode;
    message: string;
    meta?: AppDataErrorMeta;
  },
): AppDataError {
  if (error instanceof AppDataError) {
    return error;
  }

  const baseError =
    error && typeof error === "object"
      ? (error as { message?: string; status?: number })
      : { message: String(error || "") };

  return new AppDataError({
    cause: error,
    code: fallback.code || inferAppDataErrorCode(baseError),
    message: String(baseError.message || fallback.message || "").trim() || fallback.message,
    meta: fallback.meta,
  });
}

export function mapAppDataErrorMessage(
  error: unknown,
  messages: Partial<Record<AppDataErrorCode, string>>,
  fallbackMessage: string,
) {
  const appError = toAppDataError(error, {
    message: fallbackMessage,
  });

  return messages[appError.code] || fallbackMessage;
}
