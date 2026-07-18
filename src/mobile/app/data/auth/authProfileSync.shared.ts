import type { UserProfile } from "../contracts/entities";

export function normalizeProfileSyncUsername(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24);
}

export function normalizeProfileSyncEmail(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function fallbackUsernameFromEmail(email: string) {
  const local = normalizeProfileSyncUsername(String(email || "").split("@")[0] || "");
  if (local.length >= 3) return local;
  return `user_${Date.now().toString(36)}`;
}

export function normalizeProfileSyncCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter((item) => item.length > 0);
}

export function profileSyncBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  return fallback;
}

export function buildUsernameCandidates(
  baseUsername: string,
  email: string,
  userId: string,
): string[] {
  const initial = normalizeProfileSyncUsername(baseUsername);
  const fallback = fallbackUsernameFromEmail(email);
  const base = initial.length >= 3 ? initial : fallback;
  const idSeed = String(userId || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const timeSeed = Date.now().toString(36).slice(-4);
  const suffixes = ["", `_${idSeed.slice(0, 3)}`, `_${idSeed.slice(0, 6)}`, `_${timeSeed}`];

  const candidates = suffixes
    .map((suffix) => {
      const raw = suffix ? `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}` : base;
      return normalizeProfileSyncUsername(raw);
    })
    .filter((candidate) => candidate.length >= 3);

  return Array.from(new Set(candidates));
}

export function isUsernameConflict(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("profiles_username_key") ||
    (lower.includes("username") && lower.includes("unique"))
  );
}

export function isEmailConflict(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("profiles_email_key") || (lower.includes("email") && lower.includes("unique"))
  );
}

export function isProfilePatchRpcUnavailable(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("update_profile_patch") &&
    (lower.includes("function") || lower.includes("schema cache"))
  );
}

export function buildProfilePatchPayload(payload: Partial<UserProfile>) {
  const patch: Record<string, unknown> = {};
  const patchableFields: Array<keyof UserProfile> = [
    "username",
    "email",
    "university",
    "categories",
    "isPrivate",
    "hideEmail",
    "profileImage",
    "coverImage",
    "department",
    "gradeYear",
    "bio",
    "description",
    "name",
    "clubName",
  ];

  for (const field of patchableFields) {
    if (payload[field] !== undefined) {
      patch[field] = payload[field];
    }
  }

  return patch;
}
