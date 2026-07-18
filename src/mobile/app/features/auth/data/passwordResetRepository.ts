import { toSafeUiErrorMessage } from "../../../platform/security/errors";
import {
  getPasswordResetNotFoundMessage,
  requestPasswordResetEmail,
} from "../../../data/auth/passwordResetRequest";

function readErrorMessage(error: unknown) {
  return String((error as { message?: string })?.message || error || "").trim();
}

export async function sendForgotPasswordResetMail(email: string) {
  return requestPasswordResetEmail(email);
}

export function toForgotPasswordUiErrorMessage(error: unknown, fallback: string) {
  const message = readErrorMessage(error).toLowerCase();
  if (
    message.includes(getPasswordResetNotFoundMessage().toLowerCase()) ||
    message.includes("kayitli hesap bulunamadi")
  ) {
    return getPasswordResetNotFoundMessage();
  }
  return toSafeUiErrorMessage(error, fallback);
}
