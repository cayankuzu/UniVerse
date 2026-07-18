import { debugLog } from "../../platform/logging/logger";
import { supabase } from "../../platform/supabase";
import { isFunctionUnavailable } from "../../platform/api/core";
import { resolveProfileIdByUsername } from "../profile/profileLookup";

export interface RelationshipSnapshotRow {
  accountType: "club" | "student";
  isPrivate: boolean;
  username: string;
}

export interface RelationshipSnapshotProjection {
  clubPrivacyMap: Record<string, boolean>;
  following: RelationshipSnapshotRow[];
  followingClubUsernames: string[];
  followingStudentUsernames: string[];
  followingUsernames: string[];
  id: string;
  viewerId: string;
  viewerUsername: string;
}

type RelationshipSnapshotRpcResult = {
  data: unknown;
  error: unknown;
};

function getErrorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getViewerRelationshipSnapshotQueryKey(params: {
  viewerId?: string;
  viewerUsername?: string;
}) {
  return [
    "social",
    "relations",
    "snapshot",
    normalize(params.viewerId),
    normalize(params.viewerUsername),
  ] as const;
}

function normalizeSnapshotRows(rows: unknown): RelationshipSnapshotRow[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.reduce<RelationshipSnapshotRow[]>((acc, row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    const username = normalize(item?.username);
    if (!username || seen.has(username)) return acc;
    seen.add(username);
    acc.push({
      accountType:
        item?.accountType === "club" || item?.account_type === "club" ? "club" : "student",
      isPrivate:
        item?.accountType === "club" || item?.account_type === "club"
          ? false
          : Boolean(item?.isPrivate ?? item?.is_private),
      username,
    });
    return acc;
  }, []);
}

function toSnapshotProjection(params: {
  rows: RelationshipSnapshotRow[];
  viewerId?: string;
  viewerUsername?: string;
  payload?: Record<string, unknown> | null;
}): RelationshipSnapshotProjection {
  const payloadFollowingUsernames = Array.isArray(params.payload?.followingUsernames)
    ? params.payload.followingUsernames
    : Array.isArray(params.payload?.following_usernames)
      ? params.payload.following_usernames
      : [];
  const payloadFollowingClubUsernames = Array.isArray(params.payload?.followingClubUsernames)
    ? params.payload.followingClubUsernames
    : Array.isArray(params.payload?.following_club_usernames)
      ? params.payload.following_club_usernames
      : [];
  const payloadFollowingStudentUsernames = Array.isArray(params.payload?.followingStudentUsernames)
    ? params.payload.followingStudentUsernames
    : Array.isArray(params.payload?.following_student_usernames)
      ? params.payload.following_student_usernames
      : [];
  const payloadClubPrivacyMap =
    params.payload?.clubPrivacyMap && typeof params.payload.clubPrivacyMap === "object"
      ? (params.payload.clubPrivacyMap as Record<string, unknown>)
      : params.payload?.club_privacy_map && typeof params.payload.club_privacy_map === "object"
        ? (params.payload.club_privacy_map as Record<string, unknown>)
        : {};
  const followingUsernames =
    params.rows.length > 0
      ? params.rows.map((item) => item.username)
      : payloadFollowingUsernames.map(normalize).filter(Boolean);
  const followingClubUsernames =
    params.rows.length > 0
      ? params.rows.filter((item) => item.accountType === "club").map((item) => item.username)
      : payloadFollowingClubUsernames.map(normalize).filter(Boolean);
  const followingStudentUsernames =
    params.rows.length > 0
      ? params.rows.filter((item) => item.accountType === "student").map((item) => item.username)
      : payloadFollowingStudentUsernames.map(normalize).filter(Boolean);
  const clubPrivacyMap =
    params.rows.length > 0
      ? params.rows.reduce<Record<string, boolean>>((acc, item) => {
          acc[item.username] = Boolean(item.isPrivate);
          return acc;
        }, {})
      : Object.entries(payloadClubPrivacyMap).reduce<Record<string, boolean>>(
          (acc, [username, isPrivate]) => {
            const normalizedUsername = normalize(username);
            if (!normalizedUsername) return acc;
            acc[normalizedUsername] = Boolean(isPrivate);
            return acc;
          },
          {},
        );

  return {
    clubPrivacyMap,
    following: params.rows,
    followingClubUsernames,
    followingStudentUsernames,
    followingUsernames,
    id:
      normalize(params.payload?.id || "") ||
      normalize(params.viewerId || params.viewerUsername || "guest") ||
      "guest",
    viewerId: normalize(
      params.payload?.viewerId || params.payload?.viewer_id || params.viewerId || "",
    ),
    viewerUsername: normalize(
      params.payload?.viewerUsername ||
        params.payload?.viewer_username ||
        params.viewerUsername ||
        "",
    ),
  };
}

async function loadFallbackFollowing(params: {
  viewerId?: string;
  viewerUsername?: string;
}): Promise<RelationshipSnapshotRow[]> {
  const viewerId =
    normalize(params.viewerId) ||
    normalize(await resolveProfileIdByUsername(normalize(params.viewerUsername)));
  const viewerUsername = normalize(params.viewerUsername);
  if (!viewerId && !viewerUsername) return [];
  if (!viewerId) return [];

  const { data: followRows, error: followError } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .eq("status", "accepted")
    .is("deleted_at", null);

  if (followError || !Array.isArray(followRows) || followRows.length === 0) {
    return [];
  }

  const followingIds = Array.from(
    new Set(
      followRows
        .map((row) => normalize((row as { following_id?: string }).following_id))
        .filter(Boolean),
    ),
  );
  if (followingIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id,username,account_type,is_private")
    .in("user_id", followingIds)
    .is("deleted_at", null);

  if (profilesError || !Array.isArray(profiles)) {
    return [];
  }

  const profileMap = new Map(
    profiles.map((profile) => [normalize((profile as { user_id?: string }).user_id), profile]),
  );
  return followingIds.reduce<RelationshipSnapshotRow[]>((acc, followingId) => {
    const profile = profileMap.get(followingId);
    const username = normalize((profile as { username?: string } | undefined)?.username);
    if (!profile || !username) return acc;
    acc.push({
      accountType:
        (profile as { account_type?: string }).account_type === "club" ? "club" : "student",
      isPrivate:
        (profile as { account_type?: string }).account_type === "club"
          ? false
          : Boolean((profile as { is_private?: boolean }).is_private),
      username,
    });
    return acc;
  }, []);
}

async function tryLoadRelationshipSnapshotRpc(params: {
  viewerId: string;
  viewerUsername: string;
}): Promise<RelationshipSnapshotRpcResult> {
  try {
    const { data, error } = await supabase.rpc("relationship_snapshot_projection", {
      viewer_id: params.viewerId || null,
      viewer_username: params.viewerUsername || null,
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getViewerRelationshipSnapshot(params: {
  viewerId?: string;
  viewerUsername?: string;
}): Promise<RelationshipSnapshotProjection> {
  const viewerId = normalize(params.viewerId);
  const viewerUsername = normalize(params.viewerUsername);
  const { data, error } = await tryLoadRelationshipSnapshotRpc({
    viewerId,
    viewerUsername,
  });

  if (!error) {
    const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const rows = normalizeSnapshotRows(payload?.following || payload?.following_rows);
    if (payload) {
      return toSnapshotProjection({
        payload,
        rows,
        viewerId,
        viewerUsername,
      });
    }
  } else if (!isFunctionUnavailable(error)) {
    debugLog("PROJECTIONS", "relationship-snapshot-fallback", {
      fn: "relationship_snapshot_projection",
      message: getErrorMessage(error),
    });
  }

  return toSnapshotProjection({
    rows: await loadFallbackFollowing({ viewerId, viewerUsername }),
    viewerId,
    viewerUsername,
  });
}
