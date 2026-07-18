import { supabase } from "../../platform/supabase";
import type { AccountType } from "../contracts/api";
import type { UserProfile } from "../contracts/entities";
import { getCurrentAuthUserOrThrow } from "./authSession.shared";
import { PROFILE_TABLE_SELECT_COLUMNS } from "./auth.shared.profile";
import { ensureCurrentUserProfileRow, hasProfileConflict } from "./authProfileSync.ensure";
import {
  buildProfilePatchPayload,
  isProfilePatchRpcUnavailable,
  normalizeProfileSyncEmail,
  normalizeProfileSyncUsername,
} from "./authProfileSync.shared";

export async function applyProfileUpdateInTable(
  payload: Partial<UserProfile>,
  getMeFromTable: () => Promise<UserProfile>,
): Promise<UserProfile> {
  const patchPayload = buildProfilePatchPayload(payload);
  if (Object.keys(patchPayload).length === 0) {
    return getMeFromTable();
  }

  const { error: rpcError } = await supabase.rpc("update_profile_patch", {
    target_patch: patchPayload,
  });
  if (!rpcError) {
    return getMeFromTable();
  }

  const rpcMessage = String(rpcError.message || "");
  if (!isProfilePatchRpcUnavailable(rpcMessage)) {
    if (rpcMessage.toLowerCase().includes("profile not found")) {
      await ensureCurrentUserProfileRow(payload);
      return getMeFromTable();
    }
    throw new Error(rpcMessage);
  }

  const user = await getCurrentAuthUserOrThrow();
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select(PROFILE_TABLE_SELECT_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (!existing) {
    await ensureCurrentUserProfileRow(payload);
    return getMeFromTable();
  }

  const accountType: AccountType = existing.account_type === "club" ? "club" : "student";
  const updatePayload: Record<string, string | string[] | boolean | null> = {};

  if (payload.username !== undefined) {
    const nextUsername = normalizeProfileSyncUsername(payload.username || "");
    if (!nextUsername || nextUsername.length < 3) {
      throw new Error("Kullanıcı adı en az 3 karakter olmalı");
    }
    if (
      nextUsername !==
        String(existing.username || "")
          .trim()
          .toLowerCase() &&
      (await hasProfileConflict({
        column: "username",
        currentUserId: user.id,
        value: nextUsername,
      }))
    ) {
      throw new Error("Bu kullanıcı adi zaten alınmış");
    }
    updatePayload.username = nextUsername;
  }
  if (payload.email !== undefined) {
    const nextEmail = normalizeProfileSyncEmail(payload.email || "");
    if (!nextEmail) {
      throw new Error("E-posta zorunludur");
    }
    if (
      nextEmail !==
        String(existing.email || "")
          .trim()
          .toLowerCase() &&
      (await hasProfileConflict({ column: "email", currentUserId: user.id, value: nextEmail }))
    ) {
      throw new Error("Bu e-posta adresi zaten kullanılıyor");
    }
    updatePayload.email = nextEmail;
  }
  if (payload.university !== undefined)
    updatePayload.university = payload.university || "Belirtilmedi";
  if (payload.categories !== undefined) updatePayload.categories = payload.categories || [];
  if (payload.isPrivate !== undefined)
    updatePayload.is_private = accountType === "club" ? false : payload.isPrivate;
  if (payload.hideEmail !== undefined) updatePayload.hide_email = payload.hideEmail;
  if (payload.profileImage !== undefined)
    updatePayload.profile_image_path = payload.profileImage || null;
  if (payload.coverImage !== undefined) updatePayload.cover_image_path = payload.coverImage || null;
  if (payload.department !== undefined) updatePayload.department = payload.department || null;
  if (payload.gradeYear !== undefined) updatePayload.grade_year = payload.gradeYear || null;
  if (payload.bio !== undefined) updatePayload.bio = payload.bio || null;
  if (payload.description !== undefined) updatePayload.description = payload.description || null;

  if (accountType === "club") {
    updatePayload.name = null;
    if (payload.clubName !== undefined) updatePayload.club_name = payload.clubName || null;
  } else {
    updatePayload.club_name = null;
    if (payload.name !== undefined) updatePayload.name = payload.name || null;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  return getMeFromTable();
}
