import type { SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "../kv_store.ts";
import { listKvRowsByPrefix } from "./kvStoreScan.ts";
import type { EdgeUser, KvEventRecord, KvProfileRecord } from "../types.ts";

type ProfileRecordInput = Partial<KvProfileRecord> & {
  id?: string;
  userId?: string;
  email: string;
  username: string;
};

type SqlProfileRow = {
  account_type: "club" | "student";
  bio?: string | null;
  categories?: string[] | null;
  club_name?: string | null;
  cover_image_path?: string | null;
  created_at?: string | null;
  department?: string | null;
  description?: string | null;
  email: string;
  grade_year?: string | null;
  hide_email?: boolean | null;
  is_private?: boolean | null;
  name?: string | null;
  profile_image_path?: string | null;
  university?: string | null;
  user_id: string;
  username: string;
};

type ProfileStoreDeps = {
  adminSupabase: SupabaseClient;
  kvTable: string;
  normalizeEmail: (value: string) => string;
  normalizeUsername: (value: string) => string;
};

const PROFILE_SELECT_COLUMNS = [
  "user_id",
  "username",
  "email",
  "account_type",
  "university",
  "categories",
  "is_private",
  "hide_email",
  "profile_image_path",
  "cover_image_path",
  "department",
  "grade_year",
  "bio",
  "description",
  "name",
  "club_name",
  "created_at",
].join(",");

function normalizeAccountType(value: unknown): "student" | "club" {
  return value === "club" ? "club" : "student";
}

export function createProfileStore(deps: ProfileStoreDeps) {
  const { adminSupabase, kvTable, normalizeEmail, normalizeUsername } = deps;

  function normalizeProfileRecord(payload: ProfileRecordInput) {
    const accountType = normalizeAccountType(payload.accountType);
    const userId = String(payload.userId || payload.id || "").trim();
    const username = normalizeUsername(payload.username || "");
    const email = normalizeEmail(payload.email || "");
    const createdAt =
      typeof payload.createdAt === "string" && payload.createdAt.trim().length > 0
        ? payload.createdAt
        : new Date().toISOString();

    return {
      id: userId,
      username,
      email,
      accountType,
      name: accountType === "student" ? String(payload.name || username).trim() || username : "",
      clubName:
        accountType === "club" ? String(payload.clubName || username).trim() || username : "",
      university: String(payload.university || "").trim() || "Belirtilmedi",
      department: String(payload.department || "").trim(),
      gradeYear: String(payload.gradeYear || "").trim(),
      bio: String(payload.bio || "").trim(),
      description: String(payload.description || "").trim(),
      profileImage: String(payload.profileImage || "").trim(),
      coverImage: String(payload.coverImage || "").trim(),
      categories: Array.isArray(payload.categories) ? payload.categories.filter(Boolean) : [],
      isPrivate: accountType === "club" ? false : Boolean(payload.isPrivate),
      hideEmail: Boolean(payload.hideEmail),
      createdAt,
    };
  }

  function toSqlProfilePayload(
    profile: Partial<KvProfileRecord> & { id?: string; userId?: string },
  ) {
    const normalized = normalizeProfileRecord({
      userId: String(profile?.id || profile?.userId || "").trim(),
      accountType: profile?.accountType,
      username: profile?.username || "",
      email: profile?.email || "",
      university: profile?.university || "",
      categories: profile?.categories || [],
      isPrivate: profile?.isPrivate,
      hideEmail: profile?.hideEmail,
      profileImage: profile?.profileImage,
      coverImage: profile?.coverImage,
      department: profile?.department,
      gradeYear: profile?.gradeYear,
      bio: profile?.bio,
      description: profile?.description,
      name: profile?.name,
      clubName: profile?.clubName,
      createdAt: profile?.createdAt,
    });

    return {
      user_id: normalized.id,
      username: normalized.username,
      account_type: normalized.accountType,
      email: normalized.email,
      university: normalized.university,
      categories: normalized.categories,
      is_private: normalized.isPrivate,
      hide_email: normalized.hideEmail,
      profile_image_path: normalized.profileImage || null,
      cover_image_path: normalized.coverImage || null,
      department: normalized.department || null,
      grade_year: normalized.gradeYear || null,
      bio: normalized.bio || null,
      description: normalized.description || null,
      name: normalized.accountType === "student" ? normalized.name || normalized.username : null,
      club_name:
        normalized.accountType === "club" ? normalized.clubName || normalized.username : null,
      updated_by: normalized.id,
    };
  }

  function fromSqlProfileRow(row: SqlProfileRow): KvProfileRecord {
    const accountType = normalizeAccountType(row?.account_type);
    return {
      id: String(row?.user_id || "").trim(),
      username: normalizeUsername(row?.username || ""),
      email: normalizeEmail(row?.email || ""),
      accountType,
      name: accountType === "student" ? String(row?.name || "").trim() : "",
      clubName: accountType === "club" ? String(row?.club_name || "").trim() : "",
      university: String(row?.university || "").trim() || "Belirtilmedi",
      department: String(row?.department || "").trim(),
      gradeYear: String(row?.grade_year || "").trim(),
      bio: String(row?.bio || "").trim(),
      description: String(row?.description || "").trim(),
      profileImage: String(row?.profile_image_path || "").trim(),
      coverImage: String(row?.cover_image_path || "").trim(),
      categories: Array.isArray(row?.categories) ? row.categories.filter(Boolean) : [],
      isPrivate: accountType === "club" ? false : Boolean(row?.is_private),
      hideEmail: Boolean(row?.hide_email),
      createdAt: String(row?.created_at || "").trim() || new Date().toISOString(),
    };
  }

  async function readProfileFromTable(userId: string) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return null;
    const { data, error } = await adminSupabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .eq("user_id", normalizedUserId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data ? fromSqlProfileRow(data as SqlProfileRow) : null;
  }

  async function syncProfileToTable(
    profile: Partial<KvProfileRecord> & { id?: string; userId?: string },
  ) {
    const payload = toSqlProfilePayload(profile);
    const { data, error } = await adminSupabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select(PROFILE_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return fromSqlProfileRow(data as SqlProfileRow);
    }

    return normalizeProfileRecord({
      userId: payload.user_id,
      accountType: payload.account_type,
      username: payload.username,
      email: payload.email,
      university: payload.university,
      categories: payload.categories,
      isPrivate: payload.is_private,
      hideEmail: payload.hide_email,
      profileImage: payload.profile_image_path,
      coverImage: payload.cover_image_path,
      department: payload.department,
      gradeYear: payload.grade_year,
      bio: payload.bio,
      description: payload.description,
      name: payload.name,
      clubName: payload.club_name,
    });
  }

  function buildProfileSeedFromAuthUser(user: EdgeUser, fallbackProfile?: KvProfileRecord | null) {
    if (!user?.id) return null;
    const metadata = user.user_metadata || {};
    const primaryEmail =
      normalizeEmail(fallbackProfile?.email || user.email || metadata.email || "") ||
      `${String(user.id)
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase()}@profile.local`;

    const usernameFromEmail = normalizeUsername(String(primaryEmail).split("@")[0] || "");
    const username =
      normalizeUsername(
        fallbackProfile?.username ||
          metadata.username ||
          metadata.userName ||
          metadata.user_name ||
          usernameFromEmail,
      ) || usernameFromEmail;

    if (!username || username.length < 3) return null;

    return normalizeProfileRecord({
      userId: user.id,
      accountType:
        fallbackProfile?.accountType || metadata.accountType || metadata.account_type || "student",
      username,
      email: primaryEmail,
      university: fallbackProfile?.university || metadata.university || "",
      categories: fallbackProfile?.categories || metadata.categories || [],
      isPrivate: fallbackProfile?.isPrivate ?? metadata.isPrivate ?? metadata.is_private,
      hideEmail: fallbackProfile?.hideEmail ?? metadata.hideEmail ?? metadata.hide_email,
      profileImage:
        fallbackProfile?.profileImage || metadata.profileImage || metadata.avatar_url || "",
      coverImage: fallbackProfile?.coverImage || metadata.coverImage || "",
      department: fallbackProfile?.department || metadata.department || "",
      gradeYear: fallbackProfile?.gradeYear || metadata.gradeYear || metadata.grade_year || "",
      bio: fallbackProfile?.bio || metadata.bio || "",
      description: fallbackProfile?.description || metadata.description || "",
      name: fallbackProfile?.name || metadata.name || metadata.full_name || "",
      clubName: fallbackProfile?.clubName || metadata.clubName || metadata.club_name || "",
      createdAt: fallbackProfile?.createdAt,
    });
  }

  async function buildDefaultKvProfileOps(profile: KvProfileRecord) {
    const userId = String(profile?.id || "").trim();
    const username = normalizeUsername(profile?.username || "");
    const defaultEntries = [
      { key: `following:${userId}`, value: [] },
      { key: `followers:${userId}`, value: [] },
      { key: `follow_requests_sent:${userId}`, value: [] },
      { key: `follow_requests_received:${userId}`, value: [] },
      { key: `blocked:${userId}`, value: [] },
      { key: `notifications:${userId}`, value: [] },
      { key: `clubevents:${username}`, value: [] },
      { key: `photos:${userId}`, value: [] },
    ];

    const existingValues = await Promise.all(defaultEntries.map((entry) => kv.get(entry.key)));
    return defaultEntries.filter(
      (_, index) => existingValues[index] === null || existingValues[index] === undefined,
    );
  }

  async function hydrateKvProfile(profile: ProfileRecordInput & { userId?: string; id?: string }) {
    const normalized = normalizeProfileRecord({
      userId: String(profile?.id || profile?.userId || "").trim(),
      accountType: profile?.accountType,
      username: profile?.username || "",
      email: profile?.email || "",
      university: profile?.university || "",
      categories: profile?.categories || [],
      isPrivate: profile?.isPrivate,
      hideEmail: profile?.hideEmail,
      profileImage: profile?.profileImage,
      coverImage: profile?.coverImage,
      department: profile?.department,
      gradeYear: profile?.gradeYear,
      bio: profile?.bio,
      description: profile?.description,
      name: profile?.name,
      clubName: profile?.clubName,
      createdAt: profile?.createdAt,
    });

    const allUsers = (await kv.get<string[]>("all_users")) || [];
    if (!allUsers.includes(normalized.id)) allUsers.push(normalized.id);

    const defaultOps = await buildDefaultKvProfileOps(normalized);
    await kv.mset([
      { key: `profile:${normalized.id}`, value: normalized },
      { key: `idx:username:${normalized.username}`, value: normalized.id },
      { key: `idx:email:${normalized.email}`, value: normalized.id },
      { key: "all_users", value: allUsers },
      ...defaultOps,
    ]);

    return normalized;
  }

  async function loadCanonicalProfile(user: EdgeUser) {
    const userId = String(user?.id || "").trim();
    if (!userId) return null;

    const profileFromTable = await readProfileFromTable(userId);
    if (profileFromTable) {
      return hydrateKvProfile(profileFromTable);
    }

    const cachedProfile = await kv.get<KvProfileRecord>(`profile:${userId}`);
    const seed = buildProfileSeedFromAuthUser(user, cachedProfile);
    if (!seed) {
      return cachedProfile || null;
    }

    const syncedProfile = await syncProfileToTable(seed);
    return hydrateKvProfile({
      ...seed,
      ...syncedProfile,
      createdAt: cachedProfile?.createdAt || syncedProfile.createdAt || seed.createdAt,
    });
  }

  async function persistProfile(
    payload: ProfileRecordInput & { userId: string; email: string; username: string },
  ) {
    const normalizedProfile = normalizeProfileRecord(payload);
    const syncedProfile = await syncProfileToTable(normalizedProfile);
    return hydrateKvProfile({
      ...normalizedProfile,
      ...syncedProfile,
      createdAt: normalizedProfile.createdAt,
    });
  }

  async function migrateClubUsernameDependencies(
    userId: string,
    previousUsername: string,
    nextUsername: string,
  ) {
    const prev = normalizeUsername(previousUsername);
    const next = normalizeUsername(nextUsername);
    if (!prev || !next || prev === next) return;

    const clubEvents = await kv.get<string[]>(`clubevents:${prev}`).then((value) => value || []);
    await kv.mset([{ key: `clubevents:${next}`, value: clubEvents }]);
    await kv.del(`clubevents:${prev}`);

    const eventRows = await listKvRowsByPrefix<KvEventRecord>({
      adminSupabase,
      kvTable,
      prefix: "event:",
    });
    for (const row of eventRows) {
      const event = row.value || {};
      if (!event || typeof event !== "object") continue;
      const eventClubUsername = normalizeUsername(event.clubUsername || "");
      if (event.clubUserId !== userId && eventClubUsername !== prev) continue;

      await kv.set(row.key, {
        ...event,
        clubUserId: userId,
        clubUsername: next,
      });
    }
  }

  async function syncClubEventProfileFields(profile: KvProfileRecord) {
    if (profile?.accountType !== "club") return;
    const clubUserId = String(profile?.id || "").trim();
    if (!clubUserId) return;

    const clubUsername = normalizeUsername(profile?.username || "");
    if (!clubUsername) return;

    const clubDisplayName =
      String(profile?.clubName || profile?.username || "").trim() || clubUsername;
    const clubImage = String(profile?.profileImage || "").trim();
    const university = String(profile?.university || "").trim();

    const eventRows = await listKvRowsByPrefix<KvEventRecord>({
      adminSupabase,
      kvTable,
      prefix: "event:",
    });
    for (const row of eventRows) {
      const event = row.value || {};
      if (!event || typeof event !== "object") continue;
      const eventClubUsername = normalizeUsername(event.clubUsername || "");
      if (event.clubUserId !== clubUserId && eventClubUsername !== clubUsername) continue;

      await kv.set(row.key, {
        ...event,
        clubUserId,
        clubUsername,
        club: clubDisplayName,
        clubImage,
        university,
      });
    }
  }

  return {
    loadCanonicalProfile,
    migrateClubUsernameDependencies,
    persistProfile,
    syncClubEventProfileFields,
    syncProfileToTable,
  };
}
