import { StorageAPI } from "../../../data/storage/storage";
import { debugWarn } from "../../../platform/logging/logger";

interface ProfileMediaUploadParams {
  coverImageUri: string;
  currentCoverImage: string;
  currentProfileImage: string;
  profileImageUri: string;
  setUploadProgress?: (value: string) => void;
}

async function uploadChangedImage(params: {
  bucket: "avatars" | "covers";
  currentUri: string;
  filePrefix: string;
  localUri: string;
  onErrorName: string;
  progressMessage: string;
  setUploadProgress?: (value: string) => void;
}) {
  if (!params.localUri || params.localUri === params.currentUri) return params.currentUri;

  params.setUploadProgress?.(params.progressMessage);
  try {
    return await StorageAPI.uploadFile(
      {
        uri: params.localUri,
        name: `${params.filePrefix}-${Date.now()}.jpg`,
        type: "image/jpeg",
      },
      params.bucket,
    );
  } catch (error) {
    debugWarn("PROFILE/MEDIA", params.onErrorName, {
      message: String((error as { message?: string } | null)?.message || params.onErrorName),
    });
    return params.currentUri;
  }
}

export async function uploadProfileMedia(params: ProfileMediaUploadParams) {
  const [uploadedProfileImage, uploadedCoverImage] = await Promise.all([
    uploadChangedImage({
      bucket: "avatars",
      currentUri: params.currentProfileImage,
      filePrefix: "profile",
      localUri: params.profileImageUri,
      onErrorName: "profile-image-upload-failed",
      progressMessage: "Profil fotoğrafı yükleniyor...",
      setUploadProgress: params.setUploadProgress,
    }),
    uploadChangedImage({
      bucket: "covers",
      currentUri: params.currentCoverImage,
      filePrefix: "cover",
      localUri: params.coverImageUri,
      onErrorName: "cover-image-upload-failed",
      progressMessage: "Kapak fotoğrafı yükleniyor...",
      setUploadProgress: params.setUploadProgress,
    }),
  ]);

  return {
    uploadedCoverImage,
    uploadedProfileImage,
  };
}
