function readErrorMessage(error: unknown) {
  return String((error as { message?: string })?.message || error || "").trim();
}

export function toSafeUiErrorMessage(
  error: unknown,
  fallbackMessage: string,
  options: {
    invalidCredentialsMessage?: string;
    rateLimitMessage?: string;
    sessionMessage?: string;
    timeoutMessage?: string;
  } = {},
) {
  const message = readErrorMessage(error);
  const lowered = message.toLowerCase();

  if (
    lowered.includes("invalid login") ||
    lowered.includes("invalid credentials") ||
    lowered.includes("invalid_credentials")
  ) {
    return options.invalidCredentialsMessage || fallbackMessage;
  }

  if (
    lowered.includes("too many requests") ||
    lowered.includes("rate limit") ||
    lowered.includes("limiti asildi") ||
    lowered.includes("limiti aşıldı")
  ) {
    return options.rateLimitMessage || "Çok fazla istek var. Lütfen biraz sonra tekrar deneyin.";
  }

  if (
    lowered.includes("timeout") ||
    lowered.includes("time out") ||
    lowered.includes("zaman asimi") ||
    lowered.includes("zaman aşımı")
  ) {
    return options.timeoutMessage || "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.";
  }

  if (
    lowered.includes("invalid jwt") ||
    lowered.includes("jwt") ||
    lowered.includes("refresh token") ||
    lowered.includes("session") ||
    lowered.includes("oturum")
  ) {
    return options.sessionMessage || "Oturum süren doldu. Lütfen yeniden giriş yap.";
  }

  return fallbackMessage;
}

export function isEmailConfirmationError(error: unknown) {
  const lowered = readErrorMessage(error).toLowerCase();
  return lowered.includes("email not confirmed") || lowered.includes("email_not_confirmed");
}

export function isMissingProfileError(error: unknown) {
  const lowered = readErrorMessage(error).toLowerCase();
  return (
    lowered.includes("profil bulunamadi") ||
    lowered.includes("profil bulunamadı") ||
    lowered.includes("profile not found")
  );
}
