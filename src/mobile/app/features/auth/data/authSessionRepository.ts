import * as Linking from "expo-linking";
import { createTrackedAuthRedirectUrl } from "../../../platform/security/authRedirectState";
import { handleSupabaseDeepLink, supabase } from "../../../platform/supabase";
import { hardSignOut } from "../../../data/security/authSessionBoundary";

export function getInitialAuthUrl() {
  return Linking.getInitialURL();
}

export function handleAuthDeepLink(url: string) {
  return handleSupabaseDeepLink(url);
}

export function signOutAuthBoundary(reason: Parameters<typeof hardSignOut>[0]) {
  return hardSignOut(reason);
}

export function getAuthSession() {
  return supabase.auth.getSession();
}

export function subscribeToAuthState(
  listener: Parameters<typeof supabase.auth.onAuthStateChange>[0],
) {
  return supabase.auth.onAuthStateChange(listener);
}

export async function resendSignupVerification(email: string) {
  const redirectUrl = await createTrackedAuthRedirectUrl({
    flow: "signup",
    target: "auth/callback",
  });
  return supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectUrl },
  });
}

export function updateAuthUserPassword(password: string) {
  return supabase.auth.updateUser({ password });
}
