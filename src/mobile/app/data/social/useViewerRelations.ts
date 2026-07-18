import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RelationSnapshot } from "../policies/visibility";
import {
  getViewerRelationshipSnapshot,
  getViewerRelationshipSnapshotQueryKey,
} from "./relationshipSnapshot";

export interface ViewerRelations {
  buildRelationByClub: (clubUsernames: string[]) => Record<string, RelationSnapshot>;
  clubPrivacyMap: Record<string, boolean>;
  followingClubUsernames: Set<string>;
  followingStudentUsernames: Set<string>;
  followingUsernames: Set<string>;
  isLoading: boolean;
  relationByClub: Record<string, RelationSnapshot>;
  refetch: () => Promise<unknown>;
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function useViewerRelations(params: {
  blockedUsers?: string[];
  enabled?: boolean;
  viewerId?: string;
  viewerUsername?: string;
}): ViewerRelations {
  const { blockedUsers, enabled = true, viewerId = "", viewerUsername = "" } = params;
  const blockedSet = useMemo(
    () => new Set((blockedUsers || []).map((item) => normalize(item)).filter(Boolean)),
    [blockedUsers],
  );

  const snapshotQuery = useQuery({
    enabled: enabled && (!!viewerId || !!viewerUsername),
    gcTime: 30 * 60_000,
    queryFn: () =>
      getViewerRelationshipSnapshot({
        viewerId,
        viewerUsername,
      }),
    queryKey: getViewerRelationshipSnapshotQueryKey({
      viewerId,
      viewerUsername,
    }),
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: 120_000,
  });

  const followingUsernames = useMemo(() => {
    const usernames = new Set<string>();
    (snapshotQuery.data?.followingUsernames || []).forEach((item) => {
      const username = normalize(item);
      if (username && !blockedSet.has(username)) usernames.add(username);
    });
    return usernames;
  }, [blockedSet, snapshotQuery.data?.followingUsernames]);

  const followingClubUsernames = useMemo(() => {
    const usernames = new Set<string>();
    (snapshotQuery.data?.followingClubUsernames || []).forEach((item) => {
      const username = normalize(item);
      if (username && !blockedSet.has(username)) usernames.add(username);
    });
    return usernames;
  }, [blockedSet, snapshotQuery.data?.followingClubUsernames]);

  const followingStudentUsernames = useMemo(() => {
    const usernames = new Set<string>();
    (snapshotQuery.data?.followingStudentUsernames || []).forEach((item) => {
      const username = normalize(item);
      if (username && !blockedSet.has(username)) usernames.add(username);
    });
    return usernames;
  }, [blockedSet, snapshotQuery.data?.followingStudentUsernames]);

  const clubPrivacyMap = useMemo(() => {
    const nextMap: Record<string, boolean> = {};
    Object.entries(snapshotQuery.data?.clubPrivacyMap || {}).forEach(([username, isPrivate]) => {
      const normalizedUsername = normalize(username);
      if (normalizedUsername && !blockedSet.has(normalizedUsername)) {
        nextMap[normalizedUsername] = Boolean(isPrivate);
      }
    });
    return nextMap;
  }, [blockedSet, snapshotQuery.data?.clubPrivacyMap]);

  const followingArray = useMemo(() => Array.from(followingUsernames), [followingUsernames]);

  const buildRelationByClub = useCallback(
    (clubUsernames: string[]) => {
      const map: Record<string, RelationSnapshot> = {};
      clubUsernames.forEach((clubUsernameRaw) => {
        const clubUsername = normalize(clubUsernameRaw);
        if (!clubUsername) return;
        map[clubUsername] = {
          clubIsPrivate: Boolean(clubPrivacyMap[clubUsername]),
          followsClub: followingClubUsernames.has(clubUsername),
          followingUsernames: followingArray,
        };
      });
      return map;
    },
    [clubPrivacyMap, followingArray, followingClubUsernames],
  );

  const relationByClub = useMemo(() => {
    const allClubUsernames = new Set<string>(Object.keys(clubPrivacyMap));
    followingClubUsernames.forEach((username) => allClubUsernames.add(username));
    return buildRelationByClub(Array.from(allClubUsernames));
  }, [buildRelationByClub, clubPrivacyMap, followingClubUsernames]);

  return {
    buildRelationByClub,
    clubPrivacyMap,
    followingClubUsernames,
    followingStudentUsernames,
    followingUsernames,
    isLoading: snapshotQuery.isLoading,
    relationByClub,
    refetch: () => snapshotQuery.refetch(),
  };
}
