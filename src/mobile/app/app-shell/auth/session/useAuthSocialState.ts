import { useCallback, useRef } from "react";
import { BlockAPI } from "../../../data/social";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { ProjectionAPI } from "../../../data/projections/projections.shared";
import { replaceViewerBlockedVisibility } from "../../../data/social/blockedVisibility";
import { logError } from "../../../platform/observability";
import { supabase } from "../../../platform/supabase";
import { normalizeUsername, sameStringArray } from "./authHelpers";
import {
  BLOCKED_USERS_CACHE_TTL_MS,
  readBlockedUsersCache,
  writeBlockedUsersCache,
} from "./blockedUsersCache";

type Params = {
  blockedUsersRef: React.MutableRefObject<string[]>;
  isDemoRef: React.MutableRefObject<boolean>;
  setBlockedUsers: React.Dispatch<React.SetStateAction<string[]>>;
};

const BLOCKED_USERS_REFRESH_TTL_MS = 30_000;

function sortBlockedUsernames(items: string[]) {
  return [...items].sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
}

export function useAuthSocialState({ blockedUsersRef, isDemoRef, setBlockedUsers }: Params) {
  const blockedRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastBlockedRefreshAtRef = useRef(0);

  const persistBlockedUsersCache = useCallback(async (usernames: string[]) => {
    const sessionResult = supabase.auth.getSession
      ? await supabase.auth.getSession().catch(() => null)
      : null;
    const viewerId = String(sessionResult?.data.session?.user?.id || "").trim();
    if (!viewerId) return;
    await writeBlockedUsersCache(viewerId, usernames);
    replaceViewerBlockedVisibility({
      usernames,
      viewerId,
    });
  }, []);

  const refreshBlocked = useCallback(async () => {
    if (isDemoRef.current) {
      blockedRefreshPromiseRef.current = null;
      lastBlockedRefreshAtRef.current = 0;
      blockedUsersRef.current = [];
      setBlockedUsers((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    if (blockedRefreshPromiseRef.current) {
      return blockedRefreshPromiseRef.current;
    }

    if (Date.now() - lastBlockedRefreshAtRef.current < BLOCKED_USERS_REFRESH_TTL_MS) {
      return;
    }

    const refreshPromise = (async () => {
      try {
        const sessionResult = supabase.auth.getSession
          ? await supabase.auth.getSession().catch(() => null)
          : null;
        const sessionUser = sessionResult?.data.session?.user || null;
        const fallbackUserResult = sessionUser
          ? null
          : await supabase.auth.getUser().catch(() => null);
        const user = sessionUser || fallbackUserResult?.data.user || null;
        const viewerId = String(user?.id || "").trim();
        if (!viewerId) return;
        const cachedSnapshot = await readBlockedUsersCache(viewerId);
        const now = Date.now();
        if (cachedSnapshot && now - cachedSnapshot.updatedAt < BLOCKED_USERS_CACHE_TTL_MS) {
          blockedUsersRef.current = cachedSnapshot.usernames;
          replaceViewerBlockedVisibility({
            usernames: cachedSnapshot.usernames,
            viewerId,
          });
          setBlockedUsers((prev) =>
            sameStringArray(prev, cachedSnapshot.usernames) ? prev : cachedSnapshot.usernames,
          );
          lastBlockedRefreshAtRef.current = now;
          return;
        }
        const blockedEnvelope = await ProjectionAPI.getBlockedUsers({ limit: 120 }, viewerId);
        const blocked = blockedEnvelope.items;
        const selfUsername = normalizeUsername(
          String(user?.user_metadata?.username || user?.user_metadata?.user_name || ""),
        );
        const next = Array.isArray(blocked)
          ? blocked
              .map((item) => normalizeUsername(item.username))
              .filter((item) => item !== selfUsername)
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }))
          : [];
        replaceViewerBlockedVisibility({
          ids: Array.isArray(blocked) ? blocked.map((item) => item.userId || item.id) : [],
          usernames: next,
          viewerId,
        });
        lastBlockedRefreshAtRef.current = now;
        blockedUsersRef.current = next;
        setBlockedUsers((prev) => (sameStringArray(prev, next) ? prev : next));
        await writeBlockedUsersCache(viewerId, next);
      } catch (error) {
        logError(error, {
          captureInSentry: false,
          meta: {
            operation: "refresh-blocked-users",
            scope: "auth-social-state",
          },
          name: "auth-session-non-blocking-error",
        });
      }
    })();

    blockedRefreshPromiseRef.current = refreshPromise;
    void refreshPromise.then(() => {
      if (blockedRefreshPromiseRef.current === refreshPromise) {
        blockedRefreshPromiseRef.current = null;
      }
    });
    return refreshPromise;
  }, [blockedUsersRef, isDemoRef, setBlockedUsers]);

  const blockUser = useCallback(
    async (username: string, options?: { targetUserId?: string | null }) => {
      const normalized = normalizeUsername(username);
      if (isDemoRef.current) {
        const nextBlockedUsers = blockedUsersRef.current.includes(normalized)
          ? blockedUsersRef.current
          : sortBlockedUsernames([...blockedUsersRef.current, normalized]);
        blockedUsersRef.current = nextBlockedUsers;
        setBlockedUsers((prev) =>
          sameStringArray(prev, nextBlockedUsers) ? prev : nextBlockedUsers,
        );
        return;
      }
      const previousBlockedUsers = blockedUsersRef.current;
      const nextBlockedUsers = previousBlockedUsers.includes(normalized)
        ? previousBlockedUsers
        : sortBlockedUsernames([...previousBlockedUsers, normalized]);
      blockedUsersRef.current = nextBlockedUsers;
      setBlockedUsers((prev) =>
        sameStringArray(prev, nextBlockedUsers) ? prev : nextBlockedUsers,
      );
      void persistBlockedUsersCache(nextBlockedUsers);
      try {
        const result = await BlockAPI.block(normalized, {
          clientMutationId: createClientMutationId("block-toggle"),
          targetUserId: options?.targetUserId,
        });
        lastBlockedRefreshAtRef.current = 0;
        if (!result.blocked) {
          blockedUsersRef.current = previousBlockedUsers;
          setBlockedUsers(previousBlockedUsers);
          void persistBlockedUsersCache(previousBlockedUsers);
        }
      } catch (error) {
        blockedUsersRef.current = previousBlockedUsers;
        setBlockedUsers(previousBlockedUsers);
        void persistBlockedUsersCache(previousBlockedUsers);
        throw error;
      }
    },
    [blockedUsersRef, isDemoRef, persistBlockedUsersCache, setBlockedUsers],
  );

  const unblockUser = useCallback(
    async (username: string, options?: { targetUserId?: string | null }) => {
      const normalized = normalizeUsername(username);
      if (isDemoRef.current) {
        const nextBlockedUsers = blockedUsersRef.current.filter((item) => item !== normalized);
        blockedUsersRef.current = nextBlockedUsers;
        setBlockedUsers((prev) =>
          sameStringArray(prev, nextBlockedUsers) ? prev : nextBlockedUsers,
        );
        return;
      }
      const previousBlockedUsers = blockedUsersRef.current;
      const nextBlockedUsers = previousBlockedUsers.filter((item) => item !== normalized);
      blockedUsersRef.current = nextBlockedUsers;
      setBlockedUsers((prev) =>
        sameStringArray(prev, nextBlockedUsers) ? prev : nextBlockedUsers,
      );
      void persistBlockedUsersCache(nextBlockedUsers);
      try {
        await BlockAPI.unblock(normalized, {
          clientMutationId: createClientMutationId("block-unblock"),
          targetUserId: options?.targetUserId,
        });
        lastBlockedRefreshAtRef.current = 0;
      } catch (error) {
        blockedUsersRef.current = previousBlockedUsers;
        setBlockedUsers(previousBlockedUsers);
        void persistBlockedUsersCache(previousBlockedUsers);
        throw error;
      }
    },
    [blockedUsersRef, isDemoRef, persistBlockedUsersCache, setBlockedUsers],
  );

  return {
    blockUser,
    refreshBlocked,
    unblockUser,
  };
}
