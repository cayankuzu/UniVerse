import {
  readSecureJson,
  removeSecurePersistedValue,
  writeSecureJson,
} from "../../platform/storage/securePersist";
import type { RegisterPayload } from "./auth.shared";

const PENDING_REGISTRATION_STORAGE_KEY = "UNiETAS_pending_registration_v1";

type PendingRegistrationMedia = {
  coverImageContext: string;
  coverImageFileName: string;
  coverImageUri: string;
  profileImageContext: string;
  profileImageFileName: string;
  profileImageUri: string;
};

export type PendingRegistrationDraft = {
  accountType: "student" | "club";
  email: string;
  media: PendingRegistrationMedia;
  updatePayload: RegisterPayload;
  userId: string;
  username: string;
};

export async function storePendingRegistrationDraft(draft: PendingRegistrationDraft) {
  await writeSecureJson(PENDING_REGISTRATION_STORAGE_KEY, draft);
}

export async function clearPendingRegistrationDraft() {
  await removeSecurePersistedValue(PENDING_REGISTRATION_STORAGE_KEY);
}

export async function readPendingRegistrationDraft(): Promise<PendingRegistrationDraft | null> {
  const parsed = await readSecureJson<Partial<PendingRegistrationDraft>>(
    PENDING_REGISTRATION_STORAGE_KEY,
  );
  if (!parsed) return null;

  const userId = String(parsed.userId || "").trim();
  const email = String(parsed.email || "")
    .trim()
    .toLowerCase();
  const username = String(parsed.username || "")
    .trim()
    .toLowerCase();
  const accountType = parsed.accountType === "club" ? "club" : "student";
  if (!userId || !email || !username || !parsed.updatePayload || !parsed.media) {
    return null;
  }

  return {
    accountType,
    email,
    media: {
      coverImageContext: String(parsed.media.coverImageContext || ""),
      coverImageFileName: String(parsed.media.coverImageFileName || ""),
      coverImageUri: String(parsed.media.coverImageUri || ""),
      profileImageContext: String(parsed.media.profileImageContext || ""),
      profileImageFileName: String(parsed.media.profileImageFileName || ""),
      profileImageUri: String(parsed.media.profileImageUri || ""),
    },
    updatePayload: parsed.updatePayload as RegisterPayload,
    userId,
    username,
  };
}
