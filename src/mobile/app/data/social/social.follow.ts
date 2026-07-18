import type { FollowRequestItem, FollowStatusResponse, SuccessResponse } from "../contracts/api";
import type { AccountType } from "../contracts/api";
import { debugWarn } from "../../platform/logging/logger";
import { supabase } from "../../platform/supabase";
import {
  acceptIncomingFollowRequestDirect,
  readIncomingFollowRequestResolution,
} from "./social.followRequests";
import {
  readAuthenticatedUserId,
  readProfilesByUserIds,
  resolveSocialTargetUserId,
  runObservedSocialMutation,
} from "./social.helpers";
import { executeMutationRpcWithFallback } from "./social.rpc";
import { readCanonicalFollowStatus } from "./social.status";
import {
  canUseLegacyToggleForDesiredStatus,
  isDesiredFollowStatusSatisfied,
  reconcileFollowStatusDirect,
} from "./social.write";
import { toDisplayName } from "../profile/profileDisplay";
import { timeAgo } from "../../shared/utils/dateTime";
import { triggerPushDispatchWakeup } from "../notifications/pushDispatchWakeup";

type FollowRequestProfileRow = {
  account_type?: AccountType | null;
  club_name?: string | null;
  name?: string | null;
  profile_image_path?: string | null;
  university?: string | null;
  user_id: string;
  username: string;
};

export const FollowAPI = {
  toggle: async (
    username: string,
    options?: {
      desiredStatus?: FollowStatusResponse["status"] | null;
      previousStatusHint?: FollowStatusResponse["status"] | null;
      targetIsPrivate?: boolean | null;
      targetUserId?: string | null;
      clientMutationId?: string | null;
    },
  ): Promise<FollowStatusResponse> => {
    return runObservedSocialMutation({
      fallback: { status: "none" },
      missingTargetMeta: { source: "missing-target-user-id", status: "none" },
      missingViewerMeta: { source: "missing-user", status: "none" },
      mutationName: "toggle-follow",
      targetUserIdHint: options?.targetUserId,
      telemetryTarget: "follow",
      throwOnFailure: true,
      username,
      run: async ({ targetUserId, viewerId }) => {
        const desiredStatus = options?.desiredStatus || null;
        const previousStatus = options?.previousStatusHint
          ? { status: options.previousStatusHint }
          : await readCanonicalFollowStatus(username, viewerId, targetUserId);
        let rpcResult = await executeMutationRpcWithFallback({
          fallbackArgs: desiredStatus
            ? {
                desired_status: desiredStatus,
                target_user_id: targetUserId,
              }
            : {
                target_user_id: targetUserId,
              },
          fallbackName: desiredStatus ? "set_follow_status" : "toggle_follow",
          mutationOptions: options,
          primaryArgs: desiredStatus
            ? {
                desired_status: desiredStatus,
                target_user_id: targetUserId,
              }
            : {
                target_user_id: targetUserId,
              },
          primaryName: desiredStatus ? "set_follow_status_with_patch" : "toggle_follow_with_patch",
          verifyAfterPrimaryError: async () => {
            const afterPrimaryFailure = await readCanonicalFollowStatus(
              username,
              viewerId,
              targetUserId,
            );
            if (isDesiredFollowStatusSatisfied(afterPrimaryFailure.status, desiredStatus)) {
              return true;
            }
            return afterPrimaryFailure.status !== previousStatus.status;
          },
        });

        if (!rpcResult && desiredStatus && previousStatus.status === desiredStatus) {
          triggerPushDispatchWakeup("follow-toggle");
          return {
            result: previousStatus,
            successMeta: {
              source: "desired-status-already-satisfied",
              status: previousStatus.status,
            },
          };
        }

        if (
          !rpcResult &&
          desiredStatus &&
          canUseLegacyToggleForDesiredStatus(previousStatus.status, desiredStatus)
        ) {
          rpcResult = await executeMutationRpcWithFallback({
            fallbackArgs: {
              target_user_id: targetUserId,
            },
            fallbackName: "toggle_follow",
            mutationOptions: options,
            primaryArgs: {
              target_user_id: targetUserId,
            },
            primaryName: "toggle_follow_with_patch",
            verifyAfterPrimaryError: async () => {
              const afterPrimaryFailure = await readCanonicalFollowStatus(
                username,
                viewerId,
                targetUserId,
              );
              return isDesiredFollowStatusSatisfied(afterPrimaryFailure.status, desiredStatus);
            },
          });
        }
        if (!rpcResult) return null;

        let latest = await readCanonicalFollowStatus(username, viewerId, targetUserId);
        if (desiredStatus && !isDesiredFollowStatusSatisfied(latest.status, desiredStatus)) {
          const reconciled = await reconcileFollowStatusDirect({
            desiredStatus,
            targetIsPrivate: options?.targetIsPrivate,
            targetUserId,
            username,
            viewerId,
          });
          if (reconciled) {
            latest = reconciled;
          }
        }
        triggerPushDispatchWakeup("follow-toggle");
        return {
          result: latest,
          successMeta: { source: rpcResult.source, status: latest.status },
        };
      },
    });
  },

  getStatus: async (
    username: string,
    options?: { targetUserId?: string | null },
  ): Promise<FollowStatusResponse> => {
    const viewerId = await readAuthenticatedUserId();
    if (!viewerId) return { status: "none" };

    const targetUserId = await resolveSocialTargetUserId(username, options?.targetUserId);
    return readCanonicalFollowStatus(username, viewerId, targetUserId || "");
  },

  getRequests: async (): Promise<FollowRequestItem[]> => {
    const viewerId = await readAuthenticatedUserId();
    if (!viewerId) return [];

    const { data: rows, error } = await supabase
      .from("follows")
      .select("follower_id,created_at")
      .eq("following_id", viewerId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !rows) return [];

    const followerIds = rows.map((row) => row.follower_id);
    if (followerIds.length === 0) return [];

    const profiles = await readProfilesByUserIds<FollowRequestProfileRow>(
      followerIds,
      "user_id,username,name,club_name,profile_image_path,account_type,university",
    );

    const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
    return rows
      .map((row) => {
        const profile = profileMap.get(row.follower_id);
        if (!profile) return null;
        return {
          accountType: profile.account_type === "club" ? "club" : "student",
          image: profile.profile_image_path || "",
          name: toDisplayName(profile),
          time: timeAgo(row.created_at),
          university: profile.university || "",
          username: profile.username,
        } as FollowRequestItem;
      })
      .filter((item): item is FollowRequestItem => Boolean(item));
  },

  acceptRequest: async (
    username: string,
    options?: {
      notificationIdHint?: string | null;
      requesterIdHint?: string | null;
      clientMutationId?: string | null;
    },
  ): Promise<SuccessResponse> => {
    const requesterId = await resolveSocialTargetUserId(username, options?.requesterIdHint);
    if (!requesterId) return { success: false };

    const viewerId = await readAuthenticatedUserId();
    if (!viewerId) return { success: false };

    const directAcceptedFirst = await acceptIncomingFollowRequestDirect({
      notificationId: options?.notificationIdHint,
      requesterId,
      viewerId,
    });
    if (directAcceptedFirst) {
      triggerPushDispatchWakeup("follow-request-accept");
      return { success: true };
    }

    const rpcResult = await executeMutationRpcWithFallback({
      fallbackArgs: {
        action: "accept",
        requester_id: requesterId,
      },
      fallbackName: "respond_follow_request",
      mutationOptions: options,
      primaryArgs: {
        action: "accept",
        requester_id: requesterId,
      },
      primaryName: "respond_follow_request_with_patch",
      verifyAfterFallbackError: true,
      verifyAfterPrimaryError: async () =>
        (await readIncomingFollowRequestResolution(requesterId, viewerId)) === "accepted",
    });
    if (!rpcResult) {
      const directAccepted = await acceptIncomingFollowRequestDirect({
        notificationId: options?.notificationIdHint,
        requesterId,
        viewerId,
      });
      if (!directAccepted) return { success: false };
      triggerPushDispatchWakeup("follow-request-accept");
      return { success: true };
    }

    const latestStatus = await readIncomingFollowRequestResolution(requesterId, viewerId);
    if (latestStatus !== "accepted") {
      const directAccepted = await acceptIncomingFollowRequestDirect({
        notificationId: options?.notificationIdHint,
        requesterId,
        viewerId,
      });
      if (directAccepted) {
        triggerPushDispatchWakeup("follow-request-accept");
        return { success: true };
      }
    }
    if (latestStatus !== "accepted") {
      debugWarn("SOCIAL", "accept-request-not-persisted", {
        notificationId: options?.notificationIdHint,
        requesterId,
        rpcSource: rpcResult.source,
        username,
        viewerId,
      });
    }
    if (latestStatus === "accepted") {
      triggerPushDispatchWakeup("follow-request-accept");
    }
    return { success: latestStatus === "accepted" };
  },

  rejectRequest: async (
    username: string,
    options?: { requesterIdHint?: string | null; clientMutationId?: string | null },
  ): Promise<SuccessResponse> => {
    const requesterId = await resolveSocialTargetUserId(username, options?.requesterIdHint);
    if (!requesterId) return { success: false };

    const viewerId = await readAuthenticatedUserId();
    if (!viewerId) return { success: false };

    const rpcResult = await executeMutationRpcWithFallback({
      fallbackArgs: {
        action: "reject",
        requester_id: requesterId,
      },
      fallbackName: "respond_follow_request",
      mutationOptions: options,
      primaryArgs: {
        action: "reject",
        requester_id: requesterId,
      },
      primaryName: "respond_follow_request_with_patch",
      verifyAfterFallbackError: true,
      verifyAfterPrimaryError: async () => {
        const latestStatus = await readIncomingFollowRequestResolution(requesterId, viewerId);
        return latestStatus === "none" || latestStatus === "rejected";
      },
    });
    if (!rpcResult) return { success: false };

    const latestStatus = await readIncomingFollowRequestResolution(requesterId, viewerId);
    if (latestStatus === "none" || latestStatus === "rejected") {
      triggerPushDispatchWakeup("follow-request-reject");
    }
    return { success: latestStatus === "none" || latestStatus === "rejected" };
  },
};
