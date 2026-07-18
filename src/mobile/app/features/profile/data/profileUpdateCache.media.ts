import { StorageAPI } from "../../../data/storage/storage";
import { debugWarn } from "../../../platform/logging/logger";

export async function uploadProfileMedia(params: {
  coverImageUri: string;
  currentCoverImage: string;
  currentProfileImage: string;
  profileImageUri: string;
  setUploadProgress?: (value: string) => void;
}) {
  let uploadedProfileImage = params.currentProfileImage;
  let uploadedCoverImage = params.currentCoverImage;

  if (params.profileImageUri && params.profileImageUri !== params.currentProfileImage) {
    params.setUploadProgress?.("Profil fotoğrafı yükleniyor...");
    try {
      uploadedProfileImage = await StorageAPI.uploadFile(
        {
          uri: params.profileImageUri,
          name: `profile-${Date.now()}.jpg`,
          type: "image/jpeg",
        },
        "avatars",
      );
    } catch (error) {
      debugWarn("PROFILE/MEDIA", "profile-image-upload-failed", {
        message: String(
          (error as { message?: string } | null)?.message || "profile-image-upload-failed",
        ),
      });
      uploadedProfileImage = params.currentProfileImage;
    }
  }

  if (params.coverImageUri && params.coverImageUri !== params.currentCoverImage) {
    params.setUploadProgress?.("Kapak fotoğrafı yükleniyor...");
    try {
      uploadedCoverImage = await StorageAPI.uploadFile(
        {
          uri: params.coverImageUri,
          name: `cover-${Date.now()}.jpg`,
          type: "image/jpeg",
        },
        "covers",
      );
    } catch (error) {
      debugWarn("PROFILE/MEDIA", "cover-image-upload-failed", {
        message: String(
          (error as { message?: string } | null)?.message || "cover-image-upload-failed",
        ),
      });
      uploadedCoverImage = params.currentCoverImage;
    }
  }

  return {
    uploadedCoverImage,
    uploadedProfileImage,
  };
}
