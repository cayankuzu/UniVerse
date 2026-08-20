import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { getMutationActionQueue } from "../../data/queues/mutationActionQueue";
import { resumeRegisteredMutationQueues } from "./mutationQueueRegistry";
import { usePersistentQueueProcessor } from "./usePersistentQueueProcessor";

async function readMutationQueueStats(ownerId: string) {
  const queue = await getMutationActionQueue(undefined, ownerId);
  const now = Date.now();
  const pendingEntries = queue.filter(
    (entry) => entry.status === "pending" || entry.status === "running",
  );
  return {
    failedCount: queue.filter((entry) => entry.status === "failed").length,
    oldestPendingAgeMs: pendingEntries.reduce(
      (oldest, entry) => Math.max(oldest, Math.max(0, now - new Date(entry.createdAt).getTime())),
      0,
    ),
    pendingCount: pendingEntries.length,
  };
}

export function AppMutationQueueProcessor() {
  const queryClient = useQueryClient();
  const { userData } = useAuth();
  const ownerId = String(userData.id || "").trim();
  const readStats = useCallback(() => readMutationQueueStats(ownerId), [ownerId]);
  const resume = useCallback(
    () => resumeRegisteredMutationQueues({ ownerId, queryClient }),
    [ownerId, queryClient],
  );

  usePersistentQueueProcessor({
    activeDelayMs: 1_200,
    initialDelayMs: 900,
    jitterWindowMs: 320,
    lane: "mutation",
    ownerId,
    pendingResumeDelayMs: 4_000,
    readStats,
    resume,
    signalDelayMs: 350,
  });

  return null;
}
