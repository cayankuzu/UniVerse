import { AuthAPI } from "../../../data/auth/auth.api";
import type { RegisterPayload } from "../../../data/auth/auth.shared";
import type { PendingVerification } from "../../../data/contracts/auth";
import { profileToUserData } from "../../../data/normalizers/profileUserData";
import { StorageAPI } from "../../../data/storage/storage";
import { supabase } from "../../../platform/supabase";
import { isMissingProfileError } from "../../../platform/security/errors";
import {
  clearPendingRegistrationDraft,
  readPendingRegistrationDraft,
  storePendingRegistrationDraft,
  type PendingRegistrationDraft,
} from "./pendingRegistration.storage";

export {
  clearPendingRegistrationDraft,
  readPendingRegistrationDraft,
  storePendingRegistrationDraft,
};

type FinalizeParams = {
  onProgress?: (message: string) => void;
  setPendingVerification?: (value: PendingVerification) => void;
  updateUserData?: (data: ReturnType<typeof profileToUserData>) => void;
};

export const PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE =
  "Kayıt tamamlanamadi. Lütfen tekrar dene.";

function buildFinalProfilePayload(
  updatePayload: RegisterPayload,
  media: { coverImage: string; profileImage: string },
) {
  return {
    accountType: updatePayload.accountType,
    bio: updatePayload.bio || "",
    categories: Array.isArray(updatePayload.categories) ? updatePayload.categories : [],
    clubName: updatePayload.clubName || "",
    coverImage: media.coverImage,
    department: updatePayload.department || "",
    description: updatePayload.description || "",
    email: updatePayload.email.trim().toLowerCase(),
    gradeYear: updatePayload.gradeYear || "",
    isPrivate: updatePayload.isPrivate,
    name: updatePayload.name || "",
    profileImage: media.profileImage,
    university: updatePayload.university || "Belirtilmedi",
    username: updatePayload.username.trim().toLowerCase(),
  };
}

function hasPendingMedia(draft: PendingRegistrationDraft) {
  return Boolean(draft.media.profileImageUri || draft.media.coverImageUri);
}

async function ensureRegisteredProfile(draft: PendingRegistrationDraft) {
  try {
    return await AuthAPI.getMe({
      allowHardSignOut: false,
      includeMetrics: false,
      recoverSessionOnUnauthorized: false,
    });
  } catch (error) {
    if (!isMissingProfileError(error)) throw error;
  }

  await AuthAPI.register(draft.updatePayload);
  return AuthAPI.getMe({
    allowHardSignOut: false,
    includeMetrics: false,
    recoverSessionOnUnauthorized: false,
  });
}

export async function finalizePendingRegistrationAfterAuth(
  params: FinalizeParams = {},
): Promise<boolean> {
  const draft = await readPendingRegistrationDraft();
  if (!draft) return false;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id || session.user.id !== draft.userId) {
    return false;
  }

  params.onProgress?.("Profil kontrol ediliyor...");
  const baseProfile = await ensureRegisteredProfile(draft);

  if (!hasPendingMedia(draft)) {
    params.updateUserData?.(profileToUserData(baseProfile));
    params.setPendingVerification?.(null);
    await clearPendingRegistrationDraft();
    return true;
  }

  const accessToken = String(session.access_token || "").trim();
  if (!accessToken) {
    return false;
  }

  params.onProgress?.("Fotoğraflar yükleniyor...");
  const [profileImage, coverImage] = await Promise.all([
    draft.media.profileImageUri
      ? StorageAPI.uploadFile(
          {
            name: draft.media.profileImageFileName,
            type: "image/jpeg",
            uri: draft.media.profileImageUri,
          },
          "avatars",
          {
            accessToken,
            context: draft.media.profileImageContext,
          },
        )
      : Promise.resolve(String(draft.updatePayload.profileImage || "").trim()),
    draft.media.coverImageUri
      ? StorageAPI.uploadFile(
          {
            name: draft.media.coverImageFileName,
            type: "image/jpeg",
            uri: draft.media.coverImageUri,
          },
          "covers",
          {
            accessToken,
            context: draft.media.coverImageContext,
          },
        )
      : Promise.resolve(String(draft.updatePayload.coverImage || "").trim()),
  ]);

  params.onProgress?.("Profil güncelleniyor...");
  const updatedProfile = await AuthAPI.updateProfile(
    buildFinalProfilePayload(draft.updatePayload, {
      coverImage: coverImage || "",
      profileImage: profileImage || "",
    }) as Partial<import("../../../data/contracts/entities").UserProfile>,
  );
  params.updateUserData?.(profileToUserData(updatedProfile));
  params.setPendingVerification?.(null);
  await clearPendingRegistrationDraft();
  return true;
}

export async function finalizePendingRegistrationOrThrow(
  params: FinalizeParams = {},
  errorMessage = PENDING_REGISTRATION_FINALIZE_ERROR_MESSAGE,
) {
  const finalized = await finalizePendingRegistrationAfterAuth(params);
  if (!finalized) {
    throw new Error(errorMessage);
  }
}
