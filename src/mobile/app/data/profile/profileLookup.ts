import { supabase } from "../../platform/supabase";

export interface ProfileCapabilities {
  canViewHeader: boolean;
  canViewContent: boolean;
  canViewFollowers: boolean;
  canViewFollowing: boolean;
  lockedReasonCode?: string;
  lockedReasonText?: string;
}

export interface ProfileSummaryRow {
  user_id: string;
  username: string;
  account_type: "student" | "club";
  email: string | null;
  university: string | null;
  categories: string[] | null;
  profile_image_path: string | null;
  cover_image_path: string | null;
  is_private: boolean;
  hide_email: boolean;
  created_at: string | null;
  followers_count: number | null;
  following_count: number | null;
  albums_count?: number | null;
  events_count?: number | null;
  name: string | null;
  department: string | null;
  grade_year: string | null;
  bio: string | null;
  club_name: string | null;
  description: string | null;
}

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const PROFILE_LOOKUP_CACHE_TTL_MS = 30_000;
const profileIdCache = new Map<string, CacheEntry<string | null>>();
const profileCapabilitiesCache = new Map<string, CacheEntry<ProfileCapabilities | null>>();
const profileSummaryCache = new Map<string, CacheEntry<ProfileSummaryRow | null>>();

function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): {
  hit: boolean;
  value: T | null;
} {
  const cached = cache.get(key);
  if (!cached) return { hit: false, value: null };
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return { hit: false, value: null };
  }
  return { hit: true, value: cached.value };
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, {
    expiresAt: Date.now() + PROFILE_LOOKUP_CACHE_TTL_MS,
    value,
  });
  return value;
}

function readRpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? (first as T) : null;
  }
  return data && typeof data === "object" ? (data as T) : null;
}

export function invalidateProfileReadCaches(params: {
  userId?: string | null;
  usernames?: Array<string | null | undefined>;
}) {
  const normalizedUserId = String(params.userId || "").trim();
  if (normalizedUserId) {
    profileSummaryCache.delete(normalizedUserId);
    for (const cacheKey of profileCapabilitiesCache.keys()) {
      if (cacheKey.endsWith(`:${normalizedUserId}`)) {
        profileCapabilitiesCache.delete(cacheKey);
      }
    }
  }

  (params.usernames || []).forEach((username) => {
    const normalizedUsername = String(username || "")
      .trim()
      .toLowerCase();
    if (!normalizedUsername) return;
    profileIdCache.delete(normalizedUsername);
  });
}

export async function resolveProfileIdByUsername(username: string): Promise<string | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;

  const cached = readCache(profileIdCache, normalized);
  if (cached.hit) return cached.value;

  const { data: rpcData, error: rpcError } = await supabase.rpc("resolve_profile_id", {
    target_username: normalized,
  });

  if (!rpcError && rpcData) {
    if (typeof rpcData === "string") {
      return writeCache(profileIdCache, normalized, rpcData);
    }
    if (Array.isArray(rpcData) && typeof rpcData[0] === "string") {
      return writeCache(profileIdCache, normalized, rpcData[0]);
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", normalized)
    .maybeSingle();

  if (!error && data?.user_id) {
    return writeCache(profileIdCache, normalized, data.user_id as string);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const selfCandidates = [
    metadata.username,
    metadata.userName,
    metadata.user_name,
    user.email ? String(user.email).split("@")[0] : "",
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  if (selfCandidates.includes(normalized)) {
    return writeCache(profileIdCache, normalized, user.id);
  }

  if (
    String(user.email || "")
      .trim()
      .toLowerCase() === normalized
  ) {
    return writeCache(profileIdCache, normalized, user.id);
  }

  return null;
}

export async function getProfileCapabilities(
  targetProfileId: string | null | undefined,
): Promise<ProfileCapabilities | null> {
  const normalizedId = String(targetProfileId || "").trim();
  if (!normalizedId) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cacheKey = `${String(user?.id || "anon").trim() || "anon"}:${normalizedId}`;

  const cached = readCache(profileCapabilitiesCache, cacheKey);
  if (cached.hit) return cached.value;

  const { data, error } = await supabase.rpc("get_profile_capabilities", {
    target_profile_id: normalizedId,
  });

  if (error || !data) return null;

  const row = readRpcRow<Record<string, unknown>>(data);
  if (!row || typeof row !== "object") return null;

  return writeCache(profileCapabilitiesCache, cacheKey, {
    canViewHeader: Boolean(row.can_view_header),
    canViewContent: Boolean(row.can_view_content),
    canViewFollowers: Boolean(row.can_view_followers),
    canViewFollowing: Boolean(row.can_view_following),
    lockedReasonCode:
      typeof row.locked_reason_code === "string" ? row.locked_reason_code : undefined,
    lockedReasonText:
      typeof row.locked_reason_text === "string" ? row.locked_reason_text : undefined,
  });
}

export async function getProfileSummary(
  targetProfileId: string | null | undefined,
): Promise<ProfileSummaryRow | null> {
  const normalizedId = String(targetProfileId || "").trim();
  if (!normalizedId) return null;

  const cached = readCache(profileSummaryCache, normalizedId);
  if (cached.hit) return cached.value;

  const { data, error } = await supabase.rpc("get_profile_summary", {
    target_profile_id: normalizedId,
  });

  if (error || !data) return null;

  const row = readRpcRow<ProfileSummaryRow>(data);
  if (!row) return null;
  return writeCache(profileSummaryCache, normalizedId, row);
}
