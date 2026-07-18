import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { t } from "../../../shared/i18n";
import { toSafeUiErrorMessage } from "../../../platform/security/errors";
import { resetPasswordSchema, strongPasswordSchema } from "../domain/schemas";
import {
  getAuthSession,
  getInitialAuthUrl,
  handleAuthDeepLink,
  signOutAuthBoundary,
  updateAuthUserPassword,
} from "../data";

const resetPasswordFormSchema = resetPasswordSchema
  .extend({
    confirmPassword: strongPasswordSchema,
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("auth.password.reset.error.mismatch"),
        path: ["confirmPassword"],
      });
    }
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordFormSchema>;

export function useResetPasswordScreenState(params: {
  goToLogin: () => void;
  replaceWithForgotPassword: () => void;
}) {
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<ResetPasswordValues>({
    defaultValues: {
      confirmPassword: "",
      password: "",
    },
    resolver: zodResolver(resetPasswordFormSchema),
  });

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const initialUrl = await getInitialAuthUrl().catch(() => null);
      if (initialUrl) {
        const handled = await handleAuthDeepLink(initialUrl).catch(() => null);
        if (!handled) {
          await signOutAuthBoundary("reset-password-boundary");
        }
      }
      const { data } = await getAuthSession();
      if (!mounted) return;
      if (data.session) {
        setHasSession(true);
        return;
      }
      await signOutAuthBoundary("reset-password-boundary");
      params.replaceWithForgotPassword();
    };
    void checkSession();
    return () => {
      mounted = false;
    };
  }, [params]);

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      const { error } = await updateAuthUserPassword(password);
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        params.goToLogin();
      }, 3000);
    } catch (error) {
      setError("root", {
        message: toSafeUiErrorMessage(error, t("auth.password.reset.error.default")),
      });
    }
  });

  return {
    control,
    errors,
    goToLogin: params.goToLogin,
    hasSession,
    isSubmitting,
    onSubmit,
    success,
  };
}
