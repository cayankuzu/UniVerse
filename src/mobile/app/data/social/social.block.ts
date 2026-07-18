import type { BlockedUserItem } from "../contracts/api";
import type { AccountType } from "../contracts/api";
import type { ClientMutationOptions } from "../mutations/clientMutation";
import { supabase } from "../../platform/supabase";
import { resolveProfilePrivacy } from "../policies/profilePrivacy";
import {
  readAuthenticatedUserId,
  readProfilesByUserIds,
  resolveSocialTargetUserId,
  runObservedSocialMutation,
} from "./social.helpers";
import { executeMutationRpcWithFallback, readBlockedState } from "./social.rpc";
import { toDisplayName } from "../profile/profileDisplay";

type BlockedProfileRow = {
  account_type?: AccountType | null;
  club_name?: string | null;
  is_private?: boolean | null;
  name?: string | null;
  profile_image_path?: string | null;
  university?: string | null;
  user_id: string;
  username: string;
};

export const BlockAPI = {
  getBlocked: async (): Promise<BlockedUserItem[]> => {
    const viewerId = await readAuthenticatedUserId();
    if (!viewerId) return [];

    const { data: rows, error } = await supabase
      .from("blocks")
      .select("blocked_id,created_at")
      .eq("blocker_id", viewerId);

    if (error || !rows) return [];

    const blockedIds = rows.map((row) => row.blocked_id);
    if (blockedIds.length === 0) return [];

    const profiles = await readProfilesByUserIds<BlockedProfileRow>(
      blockedIds,
      "user_id,username,name,club_name,profile_image_path,university,account_type,is_private",
    );
    const blockedAtById = new Map(
      rows.map((row) => [String(row.blocked_id || "").trim(), String(row.created_at || "")]),
    );

    return profiles
      .map((profile) => ({
        accountType: (profile.account_type === "club" ? "club" : "student") as AccountType,
        blockedAt: blockedAtById.get(String(profile.user_id || "").trim()) || "",
        image: profile.profile_image_path || "",
        isPrivate: resolveProfilePrivacy(profile.account_type, profile.is_private),
        name: toDisplayName(profile),
        university: profile.university || "",
        userId: profile.user_id,
        username: profile.username,
      }))
      .sort((a, b) => {
        const aTime = new Date(a.blockedAt || 0).getTime();
        const bTime = new Date(b.blockedAt || 0).getTime();
        return bTime - aTime;
      });
  },

  block: async (
    username: string,
    options?: ClientMutationOptions & { targetUserId?: string | null },
  ): Promise<{ blocked: boolean }> => {
    return runObservedSocialMutation({
      fallback: { blocked: true },
      missingTargetMeta: { blocked: false, source: "missing-target-user-id" },
      mutationName: "block-user",
      targetUserIdHint: options?.targetUserId,
      telemetryTarget: "block",
      throwOnFailure: true,
      username,
      run: async ({ targetUserId, viewerId }) => {
        const rpcResult = await executeMutationRpcWithFallback({
          mutationOptions: options,
          primaryArgs: {
            target_username: username,
          },
          primaryName: "block_user_with_patch",
          verifyAfterPrimaryError: async () =>
            (await readBlockedState(viewerId, targetUserId)).blocked,
        });
        if (!rpcResult) return null;

        return {
          result: { blocked: true },
          successMeta: {
            blocked: true,
            source: rpcResult.source,
          },
        };
      },
    });
  },

  checkBlocked: async (username: string): Promise<{ blocked: boolean }> => {
    const viewerId = await readAuthenticatedUserId();
    if (!viewerId) return { blocked: false };

    const targetId = await resolveSocialTargetUserId(username);
    if (!targetId) return { blocked: false };

    return readBlockedState(viewerId, targetId);
  },

  toggle: async (
    username: string,
    options?: ClientMutationOptions & { targetUserId?: string | null },
  ): Promise<{ blocked: boolean }> => {
    return runObservedSocialMutation({
      fallback: { blocked: false },
      missingTargetMeta: { blocked: false, source: "missing-target-user-id" },
      mutationName: "toggle-block",
      targetUserIdHint: options?.targetUserId,
      telemetryTarget: "block",
      throwOnFailure: true,
      username,
      run: async ({ targetUserId, viewerId }) => {
        const existing = await readBlockedState(viewerId, targetUserId);
        return existing.blocked
          ? {
              result: await BlockAPI.unblock(username, {
                ...options,
                targetUserId,
              }),
            }
          : {
              result: await BlockAPI.block(username, {
                ...options,
                targetUserId,
              }),
            };
      },
    });
  },

  unblock: async (
    username: string,
    options?: ClientMutationOptions & { targetUserId?: string | null },
  ): Promise<{ blocked: boolean }> => {
    return runObservedSocialMutation({
      fallback: { blocked: false },
      missingTargetMeta: { blocked: false, source: "missing-target-user-id" },
      mutationName: "unblock-user",
      targetUserIdHint: options?.targetUserId,
      telemetryTarget: "block",
      throwOnFailure: true,
      username,
      run: async ({ targetUserId, viewerId }) => {
        const rpcResult = await executeMutationRpcWithFallback({
          mutationOptions: options,
          primaryArgs: {
            target_username: username,
          },
          primaryName: "unblock_user_with_patch",
          verifyAfterPrimaryError: async () =>
            !(await readBlockedState(viewerId, targetUserId)).blocked,
        });
        if (!rpcResult) return null;

        return {
          result: { blocked: false },
          successMeta: {
            blocked: false,
            source: rpcResult.source,
          },
        };
      },
    });
  },
};
