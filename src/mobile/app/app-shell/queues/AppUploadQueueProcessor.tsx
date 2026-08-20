import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth";
import { getUploadQueue } from "../../data/queues/uploadQueue";
import { getViewerKey } from "../../data/contracts/viewerKey";
import { resumeRegisteredUploadQueues } from "./uploadQueueRegistry";
import { usePersistentQueueProcessor } from "./usePersistentQueueProcessor";

async function readUploadQueueStats(ownerId: string) {
  const queue = await getUploadQueue(undefined, ownerId);
  const now = Date.now();
  const pendingEntries = queue.filter(
    (entry) => entry.status === "pending" || entry.status === "uploading",
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

export function AppUploadQueueProcessor() {
  const queryClient = useQueryClient();
  const { accountType, updateUserData, userData } = useAuth();
  const ownerId = String(userData.id || "").trim();
  const viewerKey = getViewerKey(userData);
  const readStats = useCallback(() => readUploadQueueStats(ownerId), [ownerId]);
  const resume = useCallback(
    () =>
      resumeRegisteredUploadQueues({
        accountType,
        ownerId,
        queryClient,
        updateUserData,
        userData,
        viewerKey,
      }),
    [accountType, ownerId, queryClient, updateUserData, userData, viewerKey],
  );

  usePersistentQueueProcessor({
    activeDelayMs: 500,
    initialDelayMs: 300,
    jitterWindowMs: 200,
    lane: "upload",
    ownerId,
    pendingResumeDelayMs: 4_000,
    readStats,
    resume,
    signalDelayMs: 250,
  });

  return null;
}
