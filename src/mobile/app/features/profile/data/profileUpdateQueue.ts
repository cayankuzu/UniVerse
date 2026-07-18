import type { QueryClient } from "@tanstack/react-query";
import { AuthAPI } from "../../../data/auth";
import {
  enqueueUpload,
  processUploadQueue,
  type UploadQueueEntry,
} from "../../../data/queues/uploadQueue";
import type { AccountType } from "../../../data/contracts/api";
import type { UserProfile } from "../../../data/contracts/entities";
import {
  applyResolvedProfileState,
  normalizeProfileUsername,
  restorePreviousProfileState,
  uploadProfileMedia,
} from "../data/profileUpdateCache";

type ProfileQueueUserData = Record<string, unknown>;

export interface ProfileUpdateQueuePayload {
  accountType: AccountType;
  bio: string;
  categories: string[];
  clubName: string;
  coverImageUri: string;
  currentCoverImage: string;
  currentProfileImage: string;
  department: string;
  description: string;
  email: string;
  gradeYear: string;
  name: string;
  previousUserData: ProfileQueueUserData;
  previousUsername: string;
  profileImageUri: string;
  university: string;
  username: string;
}

interface ProfileUpdateQueueContext {
  queryClient: QueryClient;
  setUploadProgress?: (value: string) => void;
  updateUserData: (payload: Record<string, unknown>) => void;
  viewerKey: string;
}

function toProfileUpdatePayload(entry: UploadQueueEntry) {
  return entry.payload as unknown as ProfileUpdateQueuePayload;
}

export function buildProfileUpdateQueueEntryId() {
  return `profile-update:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export async function queueProfileUpdate(params: {
  id?: string;
  ownerId?: string;
  payload: ProfileUpdateQueuePayload;
}) {
  return enqueueUpload({
    id: params.id || buildProfileUpdateQueueEntryId(),
    kind: "profile-update",
    ownerId: params.ownerId,
    payload: params.payload as unknown as Record<string, unknown>,
  });
}

export async function processProfileUpdateQueue(
  params: ProfileUpdateQueueContext & {
    entryId?: string;
    ownerId?: string;
  },
) {
  await processUploadQueue({
    entryId: params.entryId,
    kind: "profile-update",
    onFailed: async (entry) => {
      const payload = toProfileUpdatePayload(entry);
      restorePreviousProfileState({
        nextUsername: normalizeProfileUsername(payload.username),
        previousUserData: payload.previousUserData,
        previousUsername: normalizeProfileUsername(payload.previousUsername),
        queryClient: params.queryClient,
        updateUserData: params.updateUserData,
        viewerKey: params.viewerKey,
      });
    },
    ownerId: params.ownerId,
    handler: async (entry) => {
      const payload = toProfileUpdatePayload(entry);
      const { uploadedCoverImage, uploadedProfileImage } = await uploadProfileMedia({
        coverImageUri: payload.coverImageUri,
        currentCoverImage: payload.currentCoverImage,
        currentProfileImage: payload.currentProfileImage,
        profileImageUri: payload.profileImageUri,
        setUploadProgress: params.setUploadProgress,
      });
      if (payload.profileImageUri && uploadedProfileImage === payload.currentProfileImage) {
        throw new Error("Profil fotoğrafı yüklenemedi.");
      }
      if (payload.coverImageUri && uploadedCoverImage === payload.currentCoverImage) {
        throw new Error("Kapak fotoğrafı yüklenemedi.");
      }

      params.setUploadProgress?.("Profil bilgileri kaydediliyor...");
      const updatedProfile = (await AuthAPI.updateProfile({
        accountType: payload.accountType,
        bio: payload.bio,
        categories: payload.categories,
        clubName: payload.clubName,
        coverImage: uploadedCoverImage,
        department: payload.department,
        description: payload.description,
        email: payload.email,
        gradeYear: payload.gradeYear,
        name: payload.name,
        profileImage: uploadedProfileImage,
        university: payload.university,
        username: payload.username,
      })) as UserProfile;

      applyResolvedProfileState({
        previousUsername: normalizeProfileUsername(payload.previousUsername),
        profile: updatedProfile,
        queryClient: params.queryClient,
        updateUserData: params.updateUserData,
        viewerKey: params.viewerKey,
      });
    },
  });
}
