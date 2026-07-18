import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { SUPABASE_PUBLIC_ANON_KEY, SUPABASE_PUBLIC_URL } from "../config/publicEnv";
import { SUPABASE_PROJECT_ID } from "../config/supabasePublic";
import { APP_SCHEME } from "../config/runtime";
import { buildAppUrl } from "../linking/appUrl";
import { debugWarn } from "../../platform/logging/logger";
import { consumeTrackedAuthRedirectState } from "../security/authRedirectState";
import { clearTrackedSecureKeys } from "../../platform/storage/authStorage";
import {
  clearPersistedAuthSession,
  savePersistedAuthSession,
} from "../../platform/storage/authSession";
import {
  canApplyPasswordResetSession,
  isSupabaseAuthStorageKey,
  parseSupabaseDeepLink,
  resolveExpectedAuthFlow,
  type SupabaseDeepLinkTarget,
  shouldRejectSupabaseAuthPayload,
} from "./supabase.shared";

export const supabaseUrl = SUPABASE_PUBLIC_URL;
export const supabaseAnonKey = SUPABASE_PUBLIC_ANON_KEY;
export const authCallbackUrl = buildAppUrl("auth/callback");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keep Supabase auth in-memory and use the explicit SoRita-style persisted
    // session snapshot as the only durable source of truth.
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type SupabaseDeepLinkResult = {
  hadAuthPayload: boolean;
  target: SupabaseDeepLinkTarget;
};

export function createSupabaseAccessTokenClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => accessToken,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function clearSupabaseAuthStorage() {
  const keys = await AsyncStorage.getAllKeys();
  const dynamicAuthKeys = keys.filter((key) => isSupabaseAuthStorageKey(key, SUPABASE_PROJECT_ID));

  await Promise.all([clearPersistedAuthSession(), clearTrackedSecureKeys()]);
  if (dynamicAuthKeys.length > 0) {
    await AsyncStorage.multiRemove(dynamicAuthKeys);
  }
}

export async function handleSupabaseDeepLink(url: string): Promise<SupabaseDeepLinkResult> {
  const deepLink = parseSupabaseDeepLink({
    appScheme: APP_SCHEME,
    parseUrl: Linking.parse,
    url,
  });
  const expectedFlow = resolveExpectedAuthFlow(deepLink.target);
  const trackedRedirect =
    deepLink.hadAuthPayload && deepLink.target && expectedFlow
      ? await consumeTrackedAuthRedirectState({
          expectedFlow,
          providedState: deepLink.state,
          target: deepLink.target === "AuthCallback" ? "auth/callback" : "reset-password",
        })
      : null;

  if (
    shouldRejectSupabaseAuthPayload({
      expectedFlow,
      flow: deepLink.flow,
      hadAuthPayload: deepLink.hadAuthPayload,
      target: deepLink.target,
      trackedFlow: trackedRedirect?.flow,
      trackedRedirect: Boolean(trackedRedirect),
      trustedDeepLink: deepLink.trustedDeepLink,
    })
  ) {
    debugWarn("AUTH/DEEPLINK", "Rejected unexpected auth deep link", {
      hasAccessToken: Boolean(deepLink.accessToken),
      hasCode: Boolean(deepLink.code),
      hasFlow: Boolean(deepLink.flow),
      hasRefreshToken: Boolean(deepLink.refreshToken),
      hasState: Boolean(deepLink.state),
      target: deepLink.target,
      trustedDeepLink: deepLink.trustedDeepLink,
    });
    return { hadAuthPayload: false, target: deepLink.target };
  }

  if (deepLink.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(deepLink.code);
    if (error) throw error;
    await savePersistedAuthSession(data.session ?? null);
    return { hadAuthPayload: deepLink.hadAuthPayload, target: deepLink.target };
  }

  if (deepLink.accessToken && deepLink.refreshToken) {
    if (
      !canApplyPasswordResetSession({
        target: deepLink.target,
        trackedFlow: trackedRedirect?.flow,
      })
    ) {
      debugWarn("AUTH/DEEPLINK", "Rejected raw token auth deep link outside password reset flow", {
        hasState: Boolean(deepLink.state),
        target: deepLink.target,
      });
      return { hadAuthPayload: false, target: deepLink.target };
    }
    const { data, error } = await supabase.auth.setSession({
      access_token: deepLink.accessToken,
      refresh_token: deepLink.refreshToken,
    });
    if (error) throw error;
    await savePersistedAuthSession(data.session ?? null);
  } else if (deepLink.hadAuthPayload) {
    debugWarn("AUTH/DEEPLINK", "Deep link auth payload incomplete", {
      hasAccessToken: Boolean(deepLink.accessToken),
      hasRefreshToken: Boolean(deepLink.refreshToken),
      target: deepLink.target,
    });
  }
  return { hadAuthPayload: deepLink.hadAuthPayload, target: deepLink.target };
}
