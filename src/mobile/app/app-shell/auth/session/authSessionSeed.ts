import type { Session } from "@supabase/supabase-js";
import type { AccountType } from "../../../data/contracts/api";
import type { AuthUserData } from "../../../data/contracts/entities";
import { profileToUserData } from "./authContext.shared";

export function getSeededAuthStateFromSession(session: Session): {
  accountType: AccountType;
  isPrivateAccount: boolean;
  userData: AuthUserData;
} {
  const metadata = (session.user.user_metadata || {}) as Record<string, unknown>;
  const accountTypeFromMetadata = metadata.accountType || metadata.account_type;
  const accountType: AccountType = accountTypeFromMetadata === "club" ? "club" : "student";
  const email = String(metadata.email || session.user.email || "")
    .trim()
    .toLowerCase();
  const usernameSeed = String(
    metadata.username ||
      metadata.userName ||
      metadata.user_name ||
      email.split("@")[0] ||
      session.user.id.slice(0, 8),
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");
  const isPrivateAccount =
    accountType === "club" ? false : Boolean(metadata.isPrivate ?? metadata.is_private);

  return {
    accountType,
    isPrivateAccount,
    userData: profileToUserData({
      id: session.user.id,
      username: usernameSeed || `user_${session.user.id.slice(0, 8)}`,
      accountType,
      email: email || `${session.user.id}@anon.local`,
      university: String(metadata.university || "").trim() || "Belirtilmedi",
      categories: Array.isArray(metadata.categories)
        ? metadata.categories.filter(Boolean).map(String)
        : [],
      profileImage: String(
        metadata.profileImage || metadata.avatar_url || metadata.photo || "",
      ).trim(),
      coverImage: String(metadata.coverImage || "").trim(),
      isPrivate: isPrivateAccount,
      hideEmail: Boolean(metadata.hideEmail ?? metadata.hide_email),
      createdAt: session.user.created_at || new Date().toISOString(),
      followersCount: 0,
      followingCount: 0,
      albumsCount: 0,
      eventsCount: 0,
      name: accountType === "student" ? String(metadata.name || "").trim() || undefined : undefined,
      department: String(metadata.department || "").trim() || undefined,
      gradeYear: String(metadata.gradeYear || metadata.grade_year || "").trim() || undefined,
      bio: String(metadata.bio || "").trim() || undefined,
      clubName:
        accountType === "club"
          ? String(metadata.clubName || metadata.club_name || "").trim() || undefined
          : undefined,
      description: String(metadata.description || "").trim() || undefined,
    }),
  };
}
