import type { BlockedUserProjectionItem } from "../../../data/projections/projections.types";
import { submitBlockedUserReport } from "./blockedUsersRepository";
import { AuthAPI } from "../../../data/auth";
import { requestPasswordResetEmail } from "../../../data/auth/passwordResetRequest";
import { supabase } from "../../../platform/supabase";

export async function reportBlockedUser(user: BlockedUserProjectionItem) {
  return submitBlockedUserReport(user);
}

export async function updateViewerPrivacySetting(isPrivate: boolean) {
  return AuthAPI.updatePrivacy(isPrivate);
}

export async function updateViewerProfileSetting(key: "hideEmail", value: boolean) {
  return AuthAPI.updateProfile({ [key]: value });
}

export async function getCurrentAuthUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function verifySettingsPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function sendPasswordResetMail(email: string) {
  return requestPasswordResetEmail(email);
}
