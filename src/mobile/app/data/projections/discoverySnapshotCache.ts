import type { QueryClient } from "@tanstack/react-query";
import type {
  RelationshipSnapshotProjection,
  RelationshipSnapshotRow,
} from "../../data/social/relationshipSnapshot";
import { projectionKeys } from "./projectionKeys";

type FollowState = "none" | "requested" | "following";
type TargetAccountType = "club" | "student";

const DISCOVERY_SNAPSHOT_QUERY_KEY = ["discovery", "relations", "snapshot"] as const;

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toSnapshotRow(params: {
  accountType?: TargetAccountType;
  isPrivate?: boolean | null;
  username: string;
}): RelationshipSnapshotRow | null {
  const username = normalize(params.username);
  if (!username || !params.accountType) return null;
  return {
    accountType: params.accountType,
    isPrivate: params.accountType === "club" ? false : Boolean(params.isPrivate),
    username,
  };
}

function resolveCachedTargetProfile(params: {
  queryClient: QueryClient;
  username: string;
  viewerCacheKey: string;
}) {
  const overview = params.queryClient.getQueryData(
    projectionKeys.profileOverview(params.username, params.viewerCacheKey),
  ) as
    | {
        profile?: {
          accountType?: TargetAccountType | null;
          isPrivate?: boolean | null;
        };
      }
    | undefined;
  if (overview?.profile?.accountType) {
    return {
      accountType: overview.profile.accountType,
      isPrivate: overview.profile.isPrivate,
    };
  }

  const searchEntity = params.queryClient.getQueryData([
    "entity",
    "search-users",
    params.username,
  ]) as
    | {
        accountType?: TargetAccountType | null;
        account_type?: TargetAccountType | null;
        isPrivate?: boolean | null;
        is_private?: boolean | null;
      }
    | undefined;
  if (searchEntity?.accountType || searchEntity?.account_type) {
    const accountType = (searchEntity.accountType ||
      searchEntity.account_type) as TargetAccountType;
    return {
      accountType,
      isPrivate: searchEntity.isPrivate ?? searchEntity.is_private,
    };
  }

  const relationshipEntity = params.queryClient.getQueryData([
    "entity",
    "relationships",
    params.username,
  ]) as
    | {
        accountType?: TargetAccountType | null;
        account_type?: TargetAccountType | null;
        isPrivate?: boolean | null;
        is_private?: boolean | null;
      }
    | undefined;
  if (relationshipEntity?.accountType || relationshipEntity?.account_type) {
    const accountType = (relationshipEntity.accountType ||
      relationshipEntity.account_type) as TargetAccountType;
    return {
      accountType,
      isPrivate: relationshipEntity.isPrivate ?? relationshipEntity.is_private,
    };
  }

  return {
    accountType: undefined,
    isPrivate: undefined,
  };
}

function buildSnapshotFromRows(
  current: RelationshipSnapshotProjection,
  rows: RelationshipSnapshotRow[],
): RelationshipSnapshotProjection {
  const dedupedRows = rows.filter(
    (row, index, source) =>
      source.findIndex((candidate) => candidate.username === row.username) === index,
  );
  return {
    ...current,
    clubPrivacyMap: dedupedRows.reduce<Record<string, boolean>>((acc, row) => {
      acc[row.username] = Boolean(row.isPrivate);
      return acc;
    }, {}),
    following: dedupedRows,
    followingClubUsernames: dedupedRows
      .filter((row) => row.accountType === "club")
      .map((row) => row.username),
    followingStudentUsernames: dedupedRows
      .filter((row) => row.accountType === "student")
      .map((row) => row.username),
    followingUsernames: dedupedRows.map((row) => row.username),
  };
}

export function patchDiscoverySnapshotFollowState(params: {
  nextStatus: FollowState;
  queryClient: QueryClient;
  targetAccountType?: TargetAccountType;
  targetIsPrivate?: boolean | null;
  username: string;
  viewerCacheKey: string;
}) {
  const normalizedUsername = normalize(params.username);
  if (!normalizedUsername) return;

  params.queryClient.setQueriesData(
    { queryKey: DISCOVERY_SNAPSHOT_QUERY_KEY },
    (current: unknown) => {
      if (!current || typeof current !== "object") return current;
      const snapshot = current as RelationshipSnapshotProjection;
      const existingRows = Array.isArray(snapshot.following)
        ? snapshot.following.filter((row) => normalize(row.username))
        : [];
      const existingRow = existingRows.find((row) => row.username === normalizedUsername) || null;
      const cachedProfile = resolveCachedTargetProfile({
        queryClient: params.queryClient,
        username: normalizedUsername,
        viewerCacheKey: params.viewerCacheKey,
      });
      const nextRow = toSnapshotRow({
        accountType:
          params.targetAccountType || existingRow?.accountType || cachedProfile.accountType,
        isPrivate: params.targetIsPrivate ?? existingRow?.isPrivate ?? cachedProfile.isPrivate,
        username: normalizedUsername,
      });
      const nextRows = existingRows.filter((row) => row.username !== normalizedUsername);
      if (params.nextStatus === "following" && nextRow) {
        nextRows.unshift(nextRow);
      }
      return buildSnapshotFromRows(snapshot, nextRows);
    },
  );
}
