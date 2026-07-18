import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { debugWarn } from "../../../platform/logging/logger";
import { createClientMutationId } from "../../../data/mutations/clientMutation";
import {
  getMutationActionEntry,
  patchMutationActionEntry,
} from "../../../data/queues/mutationActionQueue";
import {
  applyOptimisticProfileFollowMutation,
  rollbackProfileFollowMutation,
} from "../data/profileFollowMutationPolicy";
import { useOptimisticOutboxMetaStore } from "../../../data/queues/optimisticOutboxMeta";
import {
  buildFollowActionQueueEntryId,
  processFollowActionQueue,
  queueFollowAction,
  subscribeToFollowAction,
} from "../data/followActionQueue";

export type ProfileFollowState = "none" | "requested" | "following";
type TargetAccountType = "club" | "student" | null | undefined;

interface RelationshipPatchTarget {
  id: string;
  listKey: readonly unknown[];
  removeOnNone?: boolean;
}

interface UseProfileFollowActionParams {
  currentStatus: ProfileFollowState;
  onError?: (params: {
    previousStatus: ProfileFollowState;
    rolledBackFromStatus: ProfileFollowState;
  }) => void;
  onMutateStatus?: (status: ProfileFollowState) => void;
  onSuccessStatus?: (status: ProfileFollowState) => void;
  optimisticOutbox?: {
    action: string;
    begin: (params: { action: string; entity: string; id: string }) => void;
    entity: string;
    fail: (id: string, reason: string) => void;
    id: string;
    failReason: string;
    resolve: (id: string) => void;
  };
  relationship?: RelationshipPatchTarget;
  targetProfile: {
    accountType?: TargetAccountType;
    isPrivate?: boolean;
  };
  targetUserId?: string | null;
  ownerId: string;
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}

export function useProfileFollowAction(params: UseProfileFollowActionParams) {
  const {
    currentStatus,
    onError,
    onMutateStatus,
    onSuccessStatus,
    optimisticOutbox,
    relationship,
    targetProfile,
    targetUserId,
    ownerId,
    username,
    viewerCacheKey,
    viewerUsername,
  } = params;
  const queryClient = useQueryClient();
  const outboxId = optimisticOutbox?.id || buildFollowActionQueueEntryId(username);
  const isPending = useOptimisticOutboxMetaStore(
    (state) => state.entries[outboxId]?.status === "pending",
  );
  const isMountedRef = useRef(true);
  const followSubscriptionRef = useRef<(() => void) | null>(null);
  const currentStatusRef = useRef(currentStatus);

  useEffect(() => {
    currentStatusRef.current = currentStatus;
  }, [currentStatus]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      followSubscriptionRef.current?.();
      followSubscriptionRef.current = null;
    },
    [],
  );

  const mutate = useCallback(
    async (params: { clientMutationId?: string; targetStatus: ProfileFollowState }) => {
      const previousStatus = currentStatusRef.current;
      const optimisticOutboxStore = useOptimisticOutboxMetaStore.getState();
      optimisticOutboxStore.begin({
        action: optimisticOutbox?.action || "follow-toggle",
        entity: optimisticOutbox?.entity || "profile-overview",
        id: outboxId,
      });
      currentStatusRef.current = params.targetStatus;
      onMutateStatus?.(params.targetStatus);
      applyOptimisticProfileFollowMutation({
        nextStatus: params.targetStatus,
        previousStatus,
        queryClient,
        relationship,
        targetProfile,
        username,
        viewerCacheKey,
        viewerUsername,
      });

      let entry;
      try {
        const nextPayload = {
          clientMutationId: params.clientMutationId || createClientMutationId("follow-toggle"),
          outboxFailReason: optimisticOutbox?.failReason || "follow-toggle-failed",
          outboxId,
          ownerId,
          previousStatus,
          relationship,
          targetProfile,
          targetStatus: params.targetStatus,
          targetUserId,
          username,
          viewerCacheKey,
          viewerUsername,
        };
        const queuedEntry = await getMutationActionEntry(outboxId);
        if (queuedEntry?.kind === "follow-toggle") {
          const queuedPayload = queuedEntry.payload as {
            previousStatus?: ProfileFollowState;
          };
          entry = await patchMutationActionEntry(queuedEntry.id, {
            attemptCount: 0,
            errorMessage: undefined,
            nextProcessAt:
              queuedEntry.status === "running"
                ? (queuedEntry.nextProcessAt ?? null)
                : new Date().toISOString(),
            payload: {
              ...nextPayload,
              previousStatus: queuedPayload.previousStatus || previousStatus,
            } as unknown as Record<string, unknown>,
            status: queuedEntry.status === "running" ? "running" : "pending",
          });
        }
        if (!entry) {
          entry = await queueFollowAction(nextPayload);
        }
      } catch (error) {
        debugWarn("PROFILE/FOLLOW", "follow-toggle-queue-failed", {
          message: String(
            (error as { message?: string } | null)?.message || "follow-toggle-queue-failed",
          ),
          targetStatus: params.targetStatus,
          username,
        });
        useOptimisticOutboxMetaStore
          .getState()
          .fail(outboxId, optimisticOutbox?.failReason || "follow-toggle-failed");
        currentStatusRef.current = previousStatus;
        rollbackProfileFollowMutation({
          previousStatus,
          queryClient,
          relationship,
          rolledBackFromStatus: params.targetStatus,
          targetProfile,
          username,
          viewerCacheKey,
          viewerUsername,
        });
        onError?.({
          previousStatus,
          rolledBackFromStatus: params.targetStatus,
        });
        return;
      }

      followSubscriptionRef.current?.();
      let unsubscribe: () => void = () => {};
      unsubscribe = subscribeToFollowAction(entry.id, {
        onFailed: ({ previousStatus, rolledBackFromStatus }) => {
          unsubscribe();
          followSubscriptionRef.current = null;
          if (!isMountedRef.current) return;
          currentStatusRef.current = previousStatus;
          onError?.({ previousStatus, rolledBackFromStatus });
        },
        onResolved: (status) => {
          unsubscribe();
          followSubscriptionRef.current = null;
          if (!isMountedRef.current) return;
          currentStatusRef.current = status;
          onSuccessStatus?.(status);
        },
      });
      followSubscriptionRef.current = () => {
        unsubscribe();
        followSubscriptionRef.current = null;
      };

      void processFollowActionQueue({
        entryId: entry.id,
        ownerId,
        queryClient,
      });
    },
    [
      onError,
      onMutateStatus,
      onSuccessStatus,
      optimisticOutbox?.action,
      optimisticOutbox?.entity,
      optimisticOutbox?.failReason,
      outboxId,
      ownerId,
      queryClient,
      relationship,
      targetProfile,
      targetUserId,
      username,
      viewerCacheKey,
      viewerUsername,
    ],
  );

  return {
    isPending,
    mutate,
  };
}
