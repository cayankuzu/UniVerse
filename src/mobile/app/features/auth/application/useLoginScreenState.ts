import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AUTH_VERIFICATION_BYPASS_ENABLED } from "../../../platform/config/runtime";
import { t } from "../../../shared/i18n";
import { debugLog, debugWarn } from "../../../platform/logging/logger";
import {
  isEmailConfirmationError,
  isMissingProfileError,
  toSafeUiErrorMessage,
} from "../../../platform/security/errors";
import { sanitizeEmailForLogs } from "../../../platform/security/redaction";
import type { PendingVerification } from "../../../data/contracts/auth";
import type { AuthUserData } from "../../../data/contracts/entities";
import { finalizePendingRegistrationAfterAuth } from "../data/pendingRegistration";
import { loginSchema, type LoginForm } from "../domain/schemas";

interface UseLoginScreenStateParams {
  goToVerifyEmail: (email: string) => void;
  login: (email: string, password: string) => Promise<unknown>;
  setPendingVerification: (value: PendingVerification) => void;
  updateUserData: (data: Partial<AuthUserData>) => void;
}

export function useLoginScreenState(params: UseLoginScreenStateParams) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });

  const handleLogin = handleSubmit(async ({ email, password }) => {
    debugLog("AUTH/UI", "login-submit", {
      email: sanitizeEmailForLogs(email),
      passwordLength: password.length,
    });
    try {
      await params.login(email.trim().toLowerCase(), password);
      await finalizePendingRegistrationAfterAuth({
        setPendingVerification: params.setPendingVerification,
        updateUserData: params.updateUserData,
      }).catch((finalizeError) => {
        debugWarn("AUTH/UI", "pending-registration-finalize-skipped-after-login", {
          message: String(
            (finalizeError as { message?: string })?.message || finalizeError || "unknown",
          ),
        });
      });
    } catch (error) {
      const message = String((error as { message?: string })?.message || "");
      const lowered = message.toLowerCase();
      if (isEmailConfirmationError(error)) {
        if (AUTH_VERIFICATION_BYPASS_ENABLED) {
          setError("root", {
            message: "Test doğrulaması otomatik tamamlanamadı. Lütfen tekrar dene.",
          });
          return;
        }
        params.goToVerifyEmail(email.trim().toLowerCase());
        return;
      }
      if (lowered.includes("invalid login") || lowered.includes("invalid credentials")) {
        setError("root", { message: t("auth.login.error.invalid") });
        return;
      }
      if (
        lowered.includes("unauthorized") ||
        lowered.includes("invalid jwt") ||
        lowered.includes("oturum geçersiz")
      ) {
        setError("root", { message: t("auth.login.error.session") });
        return;
      }
      if (isMissingProfileError(error)) {
        setError("root", { message: t("auth.login.error.profileMissing") });
        return;
      }
      setError("root", {
        message: toSafeUiErrorMessage(error, t("auth.login.error.default"), {
          invalidCredentialsMessage: t("auth.login.error.invalid"),
          sessionMessage: t("auth.login.error.session"),
        }),
      });
    }
  });

  return {
    control,
    errors,
    handleLogin,
    isSubmitting,
  };
}
