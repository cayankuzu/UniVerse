import type { SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "../kv_store.ts";
import type { KvProfileRecord } from "../types.ts";
import { resolveCompatProfilePrivacy } from "./compatProfilePrivacy.ts";

const PROFILE_SELECT =
  "user_id,username,name,club_name,profile_image_path,cover_image_path,university,is_private,account_type,email,categories,bio,description,department,grade_year,hide_email,created_at";

type DbProfileRow = {
  account_type: "club" | "student";
  bio?: string | null;
  categories?: string[] | null;
  club_name?: string | null;
  cover_image_path?: string | null;
  created_at?: string | null;
  department?: string | null;
  description?: string | null;
  email?: string | null;
  grade_year?: string | null;
  hide_email?: boolean | null;
  is_private?: boolean | null;
  name?: string | null;
  profile_image_path?: string | null;
  university?: string | null;
  user_id: string;
  username: string;
};

function pickProfileText(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function profileNeedsDbBackfill(profile: KvProfileRecord | null) {
  return (
    !profile ||
    !pickProfileText(profile.username) ||
    !pickProfileText(profile.name, profile.clubName) ||
    !pickProfileText(profile.university)
  );
}

function mapDbProfile(row: DbProfileRow): KvProfileRecord {
  return {
    accountType: row.account_type,
    bio: row.bio || undefined,
    categories: Array.isArray(row.categories) ? row.categories.filter(Boolean) : [],
    clubName: row.club_name || undefined,
    coverImage: row.cover_image_path || undefined,
    createdAt: row.created_at || undefined,
    department: row.department || undefined,
    description: row.description || undefined,
    email: row.email || "",
    gradeYear: row.grade_year || undefined,
    hideEmail: Boolean(row.hide_email),
    id: row.user_id,
    isPrivate: resolveCompatProfilePrivacy(row.account_type, row.is_private),
    name: row.name || undefined,
    profileImage: row.profile_image_path || undefined,
    university: row.university || "",
    username: row.username,
  };
}

function mergeProfiles(
  primary: KvProfileRecord | null,
  fallback: KvProfileRecord | null,
  userId: string,
) {
  if (!primary && !fallback) return null;
  const accountType = primary?.accountType || fallback?.accountType || "student";
  return {
    accountType,
    bio: primary?.bio || fallback?.bio,
    categories: primary?.categories?.length ? primary.categories : fallback?.categories || [],
    clubName: pickProfileText(primary?.clubName, fallback?.clubName) || undefined,
    coverImage: pickProfileText(primary?.coverImage, fallback?.coverImage) || undefined,
    createdAt: pickProfileText(primary?.createdAt, fallback?.createdAt) || undefined,
    department: pickProfileText(primary?.department, fallback?.department) || undefined,
    description: pickProfileText(primary?.description, fallback?.description) || undefined,
    email: pickProfileText(primary?.email, fallback?.email),
    gradeYear: pickProfileText(primary?.gradeYear, fallback?.gradeYear) || undefined,
    hideEmail: primary?.hideEmail ?? fallback?.hideEmail,
    id: pickProfileText(primary?.id, fallback?.id, userId),
    isPrivate: resolveCompatProfilePrivacy(accountType, primary?.isPrivate ?? fallback?.isPrivate),
    name: pickProfileText(primary?.name, fallback?.name) || undefined,
    profileImage: pickProfileText(primary?.profileImage, fallback?.profileImage) || undefined,
    university: pickProfileText(primary?.university, fallback?.university),
    username: pickProfileText(primary?.username, fallback?.username),
  } satisfies KvProfileRecord;
}

export function createAlbumProfileLoader(params: {
  adminSupabase: SupabaseClient;
  profileCache: Map<string, KvProfileRecord | null>;
}) {
  const { adminSupabase, profileCache } = params;

  return async function getProfile(userId: string) {
    if (!userId) return null;
    if (profileCache.has(userId)) return profileCache.get(userId) ?? null;
    const kvProfile = await kv.get<KvProfileRecord>(`profile:${userId}`);
    let dbProfile: KvProfileRecord | null = null;
    if (profileNeedsDbBackfill(kvProfile)) {
      const { data } = await adminSupabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", userId)
        .maybeSingle();
      dbProfile = data ? mapDbProfile(data as DbProfileRow) : null;
    }

    const normalizedProfile = mergeProfiles(kvProfile, dbProfile, userId);
    profileCache.set(userId, normalizedProfile);
    return normalizedProfile;
  };
}
