import {
  logAuthSessionError,
  toAuthSessionError,
} from "../../../platform/security/authSessionErrors";

export function reportRecoverableAuthSessionError(
  error: unknown,
  code: string,
  fallbackMessage: string,
  operation: string,
) {
  logAuthSessionError(error, {
    code,
    fallbackMessage,
    operation,
    recoverable: true,
    scope: "auth-session",
  });
}

export function toRecoverableAuthSessionError(
  error: unknown,
  code: string,
  fallbackMessage: string,
  operation: string,
) {
  return toAuthSessionError(error, {
    code,
    fallbackMessage,
    operation,
    recoverable: true,
    scope: "auth-session",
  });
}
