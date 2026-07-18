import type { SuccessResponse } from "../contracts/api";
import { get, isFunctionUnavailable, post } from "../../platform/api/core";
import { supabase } from "../../platform/supabase";
import { AUTH_VERIFICATION_BYPASS_ENABLED } from "../../platform/config/runtime";
import { createTrackedAuthRedirectUrl } from "../../platform/security/authRedirectState";
import { isPasswordPolicySatisfied, PASSWORD_POLICY } from "../../shared/security/passwordPolicy";
import {
  fallbackDeleteOwnAccount,
  fallbackRegisterToTable,
  getErrorMessage,
  type RegisterDirectPayload,
  type RegisterPayload,
  type RegisterResponse,
} from "./auth.shared";
import {
  buildRegistrationNonce,
  buildRegisterDirectMetadata,
  type EmailVerificationBypassResponse,
} from "./auth.api.helpers";
import { getMe, updatePrivacy, updateProfile } from "./auth.api.profile";

export const AuthAPI = {
  confirmEmailForTesting: async (email: string): Promise<boolean> => {
    if (!AUTH_VERIFICATION_BYPASS_ENABLED) return false;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail) return false;
    try {
      const result = await post<EmailVerificationBypassResponse>(
        "/auth/test/confirm-email",
        {
          email: normalizedEmail,
        },
        { authMode: "anon" },
      );
      return Boolean(result.success);
    } catch (error) {
      if (isFunctionUnavailable(error)) return false;
      throw error;
    }
  },

  registerDirect: async (payload: RegisterDirectPayload): Promise<RegisterResponse> => {
    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedUsername = payload.username.trim().toLowerCase();
    const registrationNonce = buildRegistrationNonce();
    const signupRedirectUrl = await createTrackedAuthRedirectUrl({
      flow: "signup",
      target: "auth/callback",
    });

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: payload.password,
      options: {
        data: buildRegisterDirectMetadata(
          payload,
          normalizedEmail,
          normalizedUsername,
          registrationNonce,
        ),
        emailRedirectTo: signupRedirectUrl,
      },
    });
    if (error) {
      const message = getErrorMessage(error).toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        throw new Error("Bu e-posta adresi zaten kullanılıyor");
      }
      throw new Error(getErrorMessage(error) || "Kayıt oluşturulamadı");
    }

    const userId = String(data.user?.id || "").trim();
    if (!userId) {
      throw new Error("Kayıt oluşturulamadı");
    }

    const identities = Array.isArray((data.user as { identities?: unknown[] } | null)?.identities)
      ? (data.user as { identities?: unknown[] }).identities
      : null;
    if (!data.session && identities && identities.length === 0) {
      throw new Error("Bu e-posta adresi zaten kullanılıyor");
    }

    try {
      await post<RegisterResponse>(
        "/auth/register-direct",
        {
          accountType: payload.accountType,
          bio: payload.bio,
          categories: payload.categories,
          clubName: payload.clubName,
          coverImage: payload.coverImage,
          department: payload.department,
          description: payload.description,
          email: normalizedEmail,
          existingUserId: userId,
          gradeYear: payload.gradeYear,
          isPrivate: payload.isPrivate,
          name: payload.name,
          profileImage: payload.profileImage,
          registrationNonce,
          university: payload.university,
          username: normalizedUsername,
        } as Record<string, unknown>,
        { authMode: "anon" },
      );
    } catch (persistError) {
      if (!isFunctionUnavailable(persistError)) {
        throw persistError;
      }
    }

    const sessionReady = Boolean(data.session?.access_token);
    const bypassedVerification =
      !sessionReady && AUTH_VERIFICATION_BYPASS_ENABLED
        ? await AuthAPI.confirmEmailForTesting(normalizedEmail).catch(() => false)
        : false;
    if (sessionReady) {
      await AuthAPI.register({
        accountType: payload.accountType,
        bio: payload.bio,
        categories: payload.categories,
        clubName: payload.clubName,
        coverImage: payload.coverImage,
        department: payload.department,
        description: payload.description,
        email: normalizedEmail,
        gradeYear: payload.gradeYear,
        isPrivate: payload.isPrivate,
        name: payload.name,
        profileImage: payload.profileImage,
        university: payload.university,
        userId,
        username: normalizedUsername,
      });
    }

    return {
      success: true,
      userId,
      requiresEmailVerification: !sessionReady && !bypassedVerification,
      sessionReady,
    };
  },

  register: async (payload: RegisterPayload): Promise<RegisterResponse> => {
    try {
      return await post<RegisterResponse>("/auth/register", payload, { authMode: "required" });
    } catch (error) {
      if (!isFunctionUnavailable(error)) throw error;
      return fallbackRegisterToTable(payload);
    }
  },

  checkUsername: async (
    username: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ available: boolean; reason?: string }> => {
    const normalized = username.trim().toLowerCase();
    if (normalized.length < 3) {
      return { available: false, reason: "Kullanıcı adı en az 3 karakter olmalı" };
    }

    try {
      return await get<{ available: boolean; reason?: string }>(
        `/auth/check-username/${normalized}`,
        { authMode: "anon", signal: options.signal },
      );
    } catch (error) {
      if (!isFunctionUnavailable(error)) throw error;
      throw new Error("Kullanıcı adı kontrol edilemedi. Tekrar dene.");
    }
  },

  checkEmail: async (
    email: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ available: boolean; exists?: boolean; reason?: string }> => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return { available: false, reason: "E-posta zorunludur" };
    }

    try {
      return await get<{ available: boolean; exists?: boolean; reason?: string }>(
        `/auth/check-email?email=${encodeURIComponent(normalized)}`,
        { authMode: "anon", signal: options.signal },
      );
    } catch (error) {
      if (!isFunctionUnavailable(error)) throw error;
      throw new Error("E-posta kontrol edilemedi. Tekrar dene.");
    }
  },

  getMe,

  updateProfile,

  updatePrivacy,

  changePassword: async (newPassword: string): Promise<SuccessResponse> => {
    if (!isPasswordPolicySatisfied(newPassword)) {
      throw new Error(
        `Şifre ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} karakter olmalı ve en az 1 küçük harf, 1 büyük harf, 1 rakam içermeli`,
      );
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message);
    return { success: true };
  },

  deleteAccount: async (): Promise<SuccessResponse> => {
    try {
      return await post<SuccessResponse>("/auth/delete-account", undefined, {
        authMode: "required",
      });
    } catch (error) {
      const message = getErrorMessage(error).toLowerCase();
      const shouldTryRpcFallback =
        isFunctionUnavailable(error) ||
        message.includes("invalid jwt") ||
        message.includes("unauthorized") ||
        message.includes("oturum geçersiz") ||
        message.includes("tekrar giriş");
      if (!shouldTryRpcFallback) throw error;

      // Force a fresh session before the RPC fallback so the PostgREST call
      // uses a valid access token for auth.uid().
      const refreshResult = await supabase.auth.refreshSession().catch(() => null);
      if (!refreshResult?.data?.session?.access_token) {
        // Refresh failed — try RPC anyway; fallbackDeleteOwnAccount does its
        // own internal refresh+retry cycle.
      }
      return fallbackDeleteOwnAccount();
    }
  },
};
