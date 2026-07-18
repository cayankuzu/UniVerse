import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toSafeUiErrorMessage } from "../../../platform/security/errors";
import { t } from "../../../shared/i18n";
import { getCurrentAuthUser, sendPasswordResetMail, verifySettingsPassword } from "../data";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut Şifre zorunlu."),
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function useChangePasswordScreenState(params: { goBack: () => void }) {
  const [success, setSuccess] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [currentPasswordInvalid, setCurrentPasswordInvalid] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
    watch,
  } = useForm<ChangePasswordValues>({
    defaultValues: { currentPassword: "" },
    resolver: zodResolver(changePasswordSchema),
  });

  const currentPassword = watch("currentPassword");
  const canSubmit = useMemo(
    () => Boolean(currentPassword.trim() && !isSubmitting),
    [currentPassword, isSubmitting],
  );

  const sendResetMail = handleSubmit(async ({ currentPassword: password }) => {
    setCurrentPasswordInvalid(false);
    try {
      const user = await getCurrentAuthUser();
      const userEmail = String(user?.email || "")
        .trim()
        .toLowerCase();
      if (!userEmail) {
        throw new Error(t("settings.password.error.userMissing"));
      }

      const { error: signInError } = await verifySettingsPassword(userEmail, password);
      if (signInError) {
        setCurrentPasswordInvalid(true);
        const message = String(signInError.message || "").toLowerCase();
        if (
          message.includes("invalid login credentials") ||
          message.includes("invalid_credentials")
        ) {
          throw new Error(t("settings.password.error.invalidCurrent"));
        }
        throw new Error(t("settings.password.error.verifyFailed"));
      }

      const { error: resetError } = await sendPasswordResetMail(userEmail);
      if (resetError) {
        throw resetError;
      }

      setVerifiedEmail(userEmail);
      setSuccess(true);
    } catch (error) {
      const message = String((error as { message?: string })?.message || "");
      if (message.toLowerCase().includes("mevcut Şifre")) {
        setCurrentPasswordInvalid(true);
      }
      setError("root", {
        message: toSafeUiErrorMessage(error, t("settings.password.error.default")),
      });
    }
  });

  return {
    canSubmit,
    control,
    currentPassword,
    currentPasswordInvalid,
    errors,
    handleBack: params.goBack,
    isSubmitting,
    sendResetMail,
    success,
    verifiedEmail,
  };
}
