import { useEffect, useState } from "react";
import type { PendingVerification } from "../../../data/contracts/auth";
import type { AuthUserData } from "../../../data/contracts/entities";
import { toSafeUiErrorMessage } from "../../../platform/security/errors";
import {
  finalizePendingRegistrationOrThrow,
  PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE,
} from "../data/pendingRegistration";
import {
  getAuthSession,
  getInitialAuthUrl,
  handleAuthDeepLink,
  signOutAuthBoundary,
  subscribeToAuthState,
} from "../data";

type Status = "loading" | "success" | "error";
interface UseAuthCallbackScreenStateParams {
  goHome: () => void;
  goToLogin: () => void;
  goToWelcome: () => void;
  setPendingVerification: (value: PendingVerification) => void;
  updateUserData: (data: Partial<AuthUserData>) => void;
}

export function useAuthCallbackScreenState(params: UseAuthCallbackScreenStateParams) {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    let timeoutRef: ReturnType<typeof setTimeout> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const handleFinalizeFailure = (error: unknown) => {
      if (!mounted) return;
      setStatus("error");
      setErrorMessage(toSafeUiErrorMessage(error, PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE));
    };

    const finishSuccess = async () => {
      await finalizePendingRegistrationOrThrow({
        setPendingVerification: params.setPendingVerification,
        updateUserData: params.updateUserData,
      });
      if (!mounted) return;
      setStatus("success");
      timeoutRef = setTimeout(() => {
        params.goHome();
      }, 1400);
    };

    const start = async () => {
      try {
        const initialUrl = await getInitialAuthUrl();
        if (initialUrl) {
          const handled = await handleAuthDeepLink(initialUrl).catch(() => null);
          if (!handled) {
            await signOutAuthBoundary("auth-recovery-failed");
          }
        }

        const { data, error } = await getAuthSession();
        if (error) throw error;

        if (data.session) {
          await finishSuccess();
          return;
        }

        const { data: authData } = subscribeToAuthState(async (event, session) => {
          if (event === "SIGNED_IN" && session) {
            authData.subscription.unsubscribe();
            void finishSuccess().catch(handleFinalizeFailure);
          }
        });
        authSubscription = authData.subscription;

        timeoutRef = setTimeout(() => {
          authData.subscription.unsubscribe();
          void signOutAuthBoundary("auth-recovery-failed");
          if (!mounted) return;
          setStatus("error");
          setErrorMessage("Doğrulama zaman aşımına uğradı. Lütfen tekrar giriş yap.");
        }, 8000);
      } catch (error) {
        await signOutAuthBoundary("auth-recovery-failed").catch(() => null);
        handleFinalizeFailure(
          toSafeUiErrorMessage(
            error,
            "Doğrulama tamamlanamadı. Lütfen bağlantıyı yeniden kullanmayı deneyin.",
          ),
        );
      }
    };

    void start();

    return () => {
      mounted = false;
      if (timeoutRef) clearTimeout(timeoutRef);
      authSubscription?.unsubscribe();
    };
  }, [params]);

  return {
    errorMessage,
    goToLogin: params.goToLogin,
    goToWelcome: params.goToWelcome,
    status,
  };
}
