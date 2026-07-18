import type { PendingVerification } from "../../../data/contracts/auth";
import { profileToUserData } from "../../../data/normalizers/profileUserData";
import { supabase } from "../../../platform/supabase";
import { AuthAPI } from "../../../data/auth/auth.api";
import type { RegisterDirectPayload, RegisterPayload } from "../../../data/auth/auth.shared";
import {
  finalizePendingRegistrationAfterAuth,
  storePendingRegistrationDraft,
} from "../data/pendingRegistration";

interface CompleteRegistrationFlowParams {
  coverImageContext: string;
  coverImageFileName: string;
  coverImageUri: string;
  goToVerifyEmail: (email: string) => void;
  normalizedEmail: string;
  normalizedUsername: string;
  profileImageContext: string;
  profileImageFileName: string;
  profileImageUri: string;
  registerPayload: RegisterDirectPayload;
  resetToHome: () => void | Promise<unknown>;
  setPendingVerification: (value: PendingVerification) => void;
  setUploadProgress: (value: string) => void;
  updatePayload: RegisterPayload;
  updateUserData: (data: Partial<ReturnType<typeof profileToUserData>>) => void;
}

async function establishRegisteredSession(email: string, password: string) {
  // First try the session created by signUp so we do not lose a valid token.
  const {
    data: { session: existingSession },
  } = await supabase.auth.getSession();
  if (existingSession?.access_token && existingSession.user?.id) {
    return existingSession.access_token;
  }

  // If local auth state is stale, refresh once before a full sign-in retry.
  const refreshResult = await supabase.auth.refreshSession().catch(() => null);
  const refreshedToken = refreshResult?.data?.session?.access_token;
  if (refreshedToken) return refreshedToken;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!signInError) {
      const accessToken = signInData.session?.access_token || null;
      if (accessToken) return accessToken;
    }
    if (attempt === 3) {
      throw signInError;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }

  throw new Error("Oturum oluşturulamadı");
}

export async function completeRegistrationFlow(params: CompleteRegistrationFlowParams) {
  const {
    coverImageContext,
    coverImageFileName,
    coverImageUri,
    goToVerifyEmail,
    normalizedEmail,
    normalizedUsername,
    profileImageContext,
    profileImageFileName,
    profileImageUri,
    registerPayload,
    resetToHome,
    setPendingVerification,
    setUploadProgress,
    updatePayload,
    updateUserData,
  } = params;

  setUploadProgress("Hesap oluşturuluyor...");
  const registerResult = await AuthAPI.registerDirect(registerPayload);
  if (!registerResult.success) {
    throw new Error("Kayıt oluşturulamadı");
  }
  await storePendingRegistrationDraft({
    accountType: registerPayload.accountType,
    email: normalizedEmail,
    media: {
      coverImageContext,
      coverImageFileName,
      coverImageUri,
      profileImageContext,
      profileImageFileName,
      profileImageUri,
    },
    updatePayload,
    userId: registerResult.userId,
    username: normalizedUsername,
  });

  if (registerResult.requiresEmailVerification) {
    setPendingVerification({
      data: { userId: registerResult.userId, username: normalizedUsername },
      email: normalizedEmail,
      type: registerPayload.accountType,
    });
    setUploadProgress("");
    goToVerifyEmail(normalizedEmail);
    return;
  }

  if (!registerResult.sessionReady) {
    await establishRegisteredSession(normalizedEmail, registerPayload.password);
  }

  const finalized = await finalizePendingRegistrationAfterAuth({
    onProgress: setUploadProgress,
    setPendingVerification,
    updateUserData,
  });
  if (!finalized) {
    throw new Error("Kayıt tamamlanamadı. Lütfen e-posta doğrulamasından sonra tekrar dene.");
  }

  await Promise.resolve(resetToHome());
}
