import { debugWarn } from "../logging/logger";
import { Sentry } from "../observability/sentry";
import { redactValue } from "./redaction";

function readAuthSessionErrorMessage(error: unknown, fallbackMessage: string) {
  const message = String((error as { message?: string } | null)?.message || "").trim();
  return message || fallbackMessage;
}

export class AuthSessionError extends Error {
  readonly code: string;
  readonly cause: unknown;
  readonly operation: string;
  readonly recoverable: boolean;
  readonly scope: string;

  constructor(params: {
    cause?: unknown;
    code: string;
    fallbackMessage: string;
    operation: string;
    recoverable?: boolean;
    scope: string;
  }) {
    super(readAuthSessionErrorMessage(params.cause, params.fallbackMessage));
    this.name = "AuthSessionError";
    this.code = params.code;
    this.cause = params.cause;
    this.operation = params.operation;
    this.recoverable = params.recoverable ?? false;
    this.scope = params.scope;
  }
}

export function toAuthSessionError(
  error: unknown,
  params: {
    code: string;
    fallbackMessage: string;
    operation: string;
    recoverable?: boolean;
    scope: string;
  },
) {
  if (error instanceof AuthSessionError) return error;
  return new AuthSessionError({
    ...params,
    cause: error,
  });
}

export function logAuthSessionError(
  error: unknown,
  params: {
    captureInSentry?: boolean;
    code: string;
    fallbackMessage: string;
    meta?: Record<string, unknown>;
    operation: string;
    recoverable?: boolean;
    scope: string;
  },
) {
  const authError = toAuthSessionError(error, params);
  const sanitizedMeta = redactValue({
    authCode: authError.code,
    operation: authError.operation,
    recoverable: authError.recoverable,
    scope: authError.scope,
    ...params.meta,
  }) as Record<string, unknown>;

  debugWarn("AUTH", authError.code, {
    ...sanitizedMeta,
    message: authError.message,
  });

  if (params.captureInSentry ?? false) {
    Sentry.captureException(authError, {
      extra: sanitizedMeta,
      tags: {
        category: "auth-session",
        operation: authError.operation,
        scope: authError.scope,
      },
    });
  }
  return authError;
}
