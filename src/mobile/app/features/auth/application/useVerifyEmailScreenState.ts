import { useCallback, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { useIsFocused } from "@react-navigation/native";
import { AppState } from "react-native";
import type { PendingVerification } from "../../../data/contracts/auth";
import type { AuthUserData } from "../../../data/contracts/entities";
import { APP_NAME } from "../../../platform/config/brand";
import {
  finalizePendingRegistrationOrThrow,
  PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE,
} from "../data/pendingRegistration";
import { getAuthSession, resendSignupVerification, subscribeToAuthState } from "../data";

export const VERIFY_EMAIL_STEPS = [
  "E-posta kutunu ac",
  `${APP_NAME}'ten gelen maili bul`,
  '"E-postanı Onayla" bağlantısına tıkla',
] as const;

interface UseVerifyEmailScreenStateParams {
  email: string;
  goHome: () => void;
  goToLogin: () => void;
  goToWelcome: () => void;
  pendingVerificationEmail?: string;
  setPendingVerification: (value: PendingVerification) => void;
  updateUserData: (data: Partial<AuthUserData>) => void;
}

export function useVerifyEmailScreenState(params: UseVerifyEmailScreenStateParams) {
  const {
    email,
    goHome,
    goToLogin,
    goToWelcome,
    pendingVerificationEmail,
    setPendingVerification,
    updateUserData,
  } = params;
  const resolvedEmail = email || pendingVerificationEmail || "";
  const isFocused = useIsFocused();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendError, setResendError] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState("");
  const [checkSuccess, setCheckSuccess] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingInFlightRef = useRef(false);
  const completingRef = useRef(false);

  useEffect(() => {
    if (resolvedEmail) return;
    goToWelcome();
  }, [goToWelcome, resolvedEmail]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const completeAndNavigate = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    try {
      await finalizePendingRegistrationOrThrow({
        setPendingVerification,
        updateUserData,
      });
      goHome();
    } catch (error) {
      setCheckSuccess(false);
      setCheckMessage(
        error instanceof Error && error.message
          ? error.message
          : PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE,
      );
      completingRef.current = false;
    }
  }, [goHome, setPendingVerification, updateUserData]);

  useEffect(() => {
    if (!isFocused) return undefined;
    pollingRef.current = setInterval(async () => {
      if (AppState.currentState !== "active" || pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        const { data } = await getAuthSession();
        if (AppState.currentState === "active" && data.session?.user?.email_confirmed_at) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          void completeAndNavigate();
        }
      } catch {
        // The realtime auth subscription and manual verification action remain authoritative.
      } finally {
        pollingInFlightRef.current = false;
      }
    }, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [completeAndNavigate, isFocused]);

  useEffect(() => {
    const { data } = subscribeToAuthState(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
        void completeAndNavigate();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [completeAndNavigate]);

  const handleCheckVerification = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setCheckMessage("");
    setCheckSuccess(false);
    try {
      const { data } = await getAuthSession();
      if (data.session?.user?.email_confirmed_at) {
        setCheckSuccess(true);
        setCheckMessage("E-posta doğrulandı! Ana sayfaya yönlendiriliyorsun...");
        setTimeout(() => {
          void completeAndNavigate();
        }, 1200);
        return;
      }
      setCheckMessage("E-posta henüz doğrulanmadı. Lütfen gelen kutunu kontrol et.");
    } catch {
      setCheckMessage("Kontrol sırasında hata oluştu. Tekrar dene.");
    } finally {
      setChecking(false);
    }
  }, [checking, completeAndNavigate]);

  const handleResend = useCallback(async () => {
    if (!resolvedEmail || resending || countdown > 0) return;
    setResending(true);
    setResendError("");
    setResent(false);
    try {
      const { error } = await resendSignupVerification(resolvedEmail);
      if (error) throw error;
      setResent(true);
      setCountdown(60);
    } catch {
      setResendError("E-posta gönderilemedi. Lütfen tekrar deneyin.");
    } finally {
      setResending(false);
    }
  }, [countdown, resolvedEmail, resending]);

  return {
    checkMessage,
    checkSuccess,
    checking,
    countdown,
    email: resolvedEmail,
    goToLogin,
    handleCheckVerification,
    handleOpenMail: () => Linking.openURL(`mailto:${resolvedEmail}`),
    handleResend,
    resendError,
    resending,
    resent,
  };
}
