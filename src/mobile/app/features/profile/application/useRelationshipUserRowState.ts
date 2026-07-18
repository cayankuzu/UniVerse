import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import { prefetchProfileExperience } from "../../../data/projections/prefetch/intentPrefetch";
import type { RelationshipProjectionItem } from "../data";
import { normalizeDisplayProfileFollowStatus } from "../domain/viewProfileState.helpers";
import { useProfileFollowAction } from "./useProfileFollowAction";

export function useRelationshipUserRowState(params: {
  isOwnFollowingList: boolean;
  item: RelationshipProjectionItem;
  listKey: readonly unknown[];
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  const { isOwnFollowingList, item, listKey, viewerId, viewerKey, viewerUsername } = params;
  const queryClient = useQueryClient();
  const isPrivate = Boolean(item.accountType === "club" ? false : item.isPrivate);
  const followStatus = normalizeDisplayProfileFollowStatus({
    accountType: item.accountType,
    followStatus: item.viewerFollowStatus || "none",
  });
  const followMutation = useProfileFollowAction({
    currentStatus: followStatus,
    ownerId: viewerId || "",
    relationship: {
      id: item.id,
      listKey,
      removeOnNone: isOwnFollowingList,
    },
    targetProfile: {
      accountType: item.accountType,
      isPrivate,
    },
    username: item.username,
    viewerCacheKey: viewerKey,
    viewerUsername,
  });

  const handlePressIn = useCallback(() => {
    if (!item.username) return;
    void prefetchProfileExperience({
      queryClient,
      username: item.username,
      viewerId,
      viewerKey,
      viewerUsername,
    });
  }, [item.username, queryClient, viewerId, viewerKey, viewerUsername]);

  const handleToggleFollow = useCallback(() => {
    const nextStatus =
      followStatus === "following" || followStatus === "requested"
        ? "none"
        : isPrivate
          ? "requested"
          : "following";
    followMutation.mutate({
      clientMutationId: createClientMutationId("follow-toggle"),
      targetStatus: nextStatus,
    });
  }, [followMutation, followStatus, isPrivate]);

  return {
    followStatus,
    handlePressIn,
    handleToggleFollow,
    isPending: followMutation.isPending,
    isPrivate,
  };
}
