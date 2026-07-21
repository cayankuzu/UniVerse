import { supabase } from "../../platform/supabase";
import { createTrackedAuthRedirectUrl } from "../../platform/security/authRedirectState";
import { AuthAPI } from "./auth.api";

const PASSWORD_RESET_NOT_FOUND_MESSAGE = "Bu e-posta adresi ile kayıtlı hesap bulunamadı.";
const PASSWORD_RESET_CHECK_FAILED_MESSAGE =
  "Şifre sıfırlama isteği şu anda doğrulanamıyor. Lütfen tekrar deneyin.";

export function getPasswordResetNotFoundMessage() {
  return PASSWORD_RESET_NOT_FOUND_MESSAGE;
}

export async function requestPasswordResetEmail(email: string) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw new Error(PASSWORD_RESET_NOT_FOUND_MESSAGE);
  }

  const availability = await AuthAPI.checkEmail(normalizedEmail);
  if (availability.exists !== true) {
    if (availability.exists === false || availability.available) {
      throw new Error(PASSWORD_RESET_NOT_FOUND_MESSAGE);
    }
    throw new Error(availability.reason || PASSWORD_RESET_CHECK_FAILED_MESSAGE);
  }

  const redirectUrl = await createTrackedAuthRedirectUrl({
    flow: "password-reset",
    target: "reset-password",
  });

  return supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: redirectUrl,
  });
}
