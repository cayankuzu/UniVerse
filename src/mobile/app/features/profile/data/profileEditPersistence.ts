import type { QueryClient } from "@tanstack/react-query";
import { RUNTIME_FLAGS } from "../../../platform/config/runtime";
import { AuthAPI } from "../../../data/auth";
import { getUploadEntry } from "../../../data/queues/uploadQueue";
import type { EditProfileFormValues } from "../domain/editProfile.schema";
import {
  applyOptimisticProfileState,
  applyResolvedProfileState,
  normalizeProfileUsername,
  restorePreviousProfileState,
  uploadProfileMedia,
} from "./profileUpdateCache";
import { processProfileUpdateQueue, queueProfileUpdate } from "./profileUpdateQueue";

interface PersistEditedProfileParams {
  accountType: "club" | "student";
  coverImageUri: string;
  form: EditProfileFormValues;
  isClub: boolean;
  profileImageUri: string;
  queryClient: QueryClient;
  selectedCategories: string[];
  setUploadProgress: (value: string) => void;
  updateUserData: (payload: Record<string, unknown>) => void;
  userData: Record<string, unknown>;
  viewerKey: string;
}

function buildOptimisticUserData(params: PersistEditedProfileParams) {
  return {
    bio: params.isClub ? "" : params.form.bio?.trim() || "",
    categories: params.selectedCategories,
    clubName: params.isClub ? params.form.clubName?.trim() || "" : "",
    coverImage: params.coverImageUri || String(params.userData.coverImage || ""),
    department: params.isClub ? "" : params.form.department?.trim() || "",
    description: params.isClub ? params.form.description?.trim() || "" : "",
    email: params.form.email.trim().toLowerCase(),
    gradeYear: params.isClub ? "" : params.form.gradeYear?.trim() || "",
    id: String(params.userData.id || ""),
    name: params.isClub ? "" : params.form.name?.trim() || "",
    profileImage: params.profileImageUri || String(params.userData.profileImage || ""),
    university: params.form.university.trim(),
    username: params.form.username.trim().toLowerCase(),
  };
}

async function waitForProfileUpdateSettlement(params: {
  entryId: string;
  onRetryPending?: (attemptCount: number) => void;
  process: () => Promise<void>;
}) {
  for (;;) {
    await params.process();
    const queuedEntry = await getUploadEntry(params.entryId);
    if (!queuedEntry) {
      return;
    }
    if (queuedEntry.status === "failed") {
      throw new Error(queuedEntry.errorMessage || "Profil güncellenemedi.");
    }

    params.onRetryPending?.(queuedEntry.attemptCount);
    const nextProcessAtMs = new Date(String(queuedEntry.nextProcessAt || "")).getTime();
    const waitMs = Number.isFinite(nextProcessAtMs)
      ? Math.max(200, nextProcessAtMs - Date.now())
      : 1_500;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 30_000)));
  }
}

export async function persistEditedProfile(params: PersistEditedProfileParams) {
  const optimisticUserData = buildOptimisticUserData(params);
  const previousUserData = { ...params.userData };
  const previousUsername = normalizeProfileUsername(String(params.userData.username || ""));
  const nextUsername = normalizeProfileUsername(optimisticUserData.username);

  applyOptimisticProfileState({
    optimisticUserData,
    previousUsername,
    queryClient: params.queryClient,
    updateUserData: params.updateUserData,
    viewerKey: params.viewerKey,
  });

  try {
    if (RUNTIME_FLAGS.useOptimisticProfileUpdate) {
      const queuedEntry = await queueProfileUpdate({
        ownerId: String(params.userData.id || ""),
        payload: {
          accountType: params.accountType,
          bio: optimisticUserData.bio,
          categories: params.selectedCategories,
          clubName: optimisticUserData.clubName,
          coverImageUri:
            params.coverImageUri !== String(params.userData.coverImage || "")
              ? params.coverImageUri
              : "",
          currentCoverImage: String(params.userData.coverImage || ""),
          currentProfileImage: String(params.userData.profileImage || ""),
          department: optimisticUserData.department,
          description: optimisticUserData.description,
          email: optimisticUserData.email,
          gradeYear: optimisticUserData.gradeYear,
          name: optimisticUserData.name,
          previousUserData,
          previousUsername,
          profileImageUri:
            params.profileImageUri !== String(params.userData.profileImage || "")
              ? params.profileImageUri
              : "",
          university: optimisticUserData.university,
          username: optimisticUserData.username,
        },
      });
      await waitForProfileUpdateSettlement({
        entryId: queuedEntry.id,
        onRetryPending: (attemptCount) => {
          if (attemptCount > 0) {
            params.setUploadProgress("Bağlantı bekleniyor, profil kaydı yeniden denenecek...");
          }
        },
        process: () =>
          processProfileUpdateQueue({
            entryId: queuedEntry.id,
            ownerId: String(params.userData.id || ""),
            queryClient: params.queryClient,
            setUploadProgress: params.setUploadProgress,
            updateUserData: params.updateUserData,
            viewerKey: params.viewerKey,
          }),
      });
      return;
    }

    const { uploadedCoverImage, uploadedProfileImage } = await uploadProfileMedia({
      coverImageUri: params.coverImageUri,
      currentCoverImage: String(params.userData.coverImage || ""),
      currentProfileImage: String(params.userData.profileImage || ""),
      profileImageUri: params.profileImageUri,
      setUploadProgress: params.setUploadProgress,
    });
    if (
      params.profileImageUri &&
      uploadedProfileImage === String(params.userData.profileImage || "")
    ) {
      throw new Error("Profil fotoğrafı yüklenemedi.");
    }
    if (params.coverImageUri && uploadedCoverImage === String(params.userData.coverImage || "")) {
      throw new Error("Kapak fotoğrafı yüklenemedi.");
    }

    params.setUploadProgress("Profil bilgileri kaydediliyor...");
    const updatedProfile = await AuthAPI.updateProfile({
      accountType: params.accountType,
      bio: String(optimisticUserData.bio || ""),
      categories: params.selectedCategories,
      clubName: String(optimisticUserData.clubName || ""),
      coverImage: uploadedCoverImage,
      department: String(optimisticUserData.department || ""),
      description: String(optimisticUserData.description || ""),
      email: String(optimisticUserData.email || ""),
      gradeYear: String(optimisticUserData.gradeYear || ""),
      name: String(optimisticUserData.name || ""),
      profileImage: uploadedProfileImage,
      university: String(optimisticUserData.university || ""),
      username: String(optimisticUserData.username || ""),
    });
    applyResolvedProfileState({
      previousUsername,
      profile: updatedProfile,
      queryClient: params.queryClient,
      updateUserData: params.updateUserData,
      viewerKey: params.viewerKey,
    });
  } catch (error) {
    restorePreviousProfileState({
      nextUsername,
      previousUserData,
      previousUsername,
      queryClient: params.queryClient,
      updateUserData: params.updateUserData,
      viewerKey: params.viewerKey,
    });
    throw error;
  }
}
