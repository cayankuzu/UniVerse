import type { QueryClient } from "@tanstack/react-query";
import { debugWarn } from "../../../platform/logging/logger";

import {
  prefetchAlbumViewExperience,
  prefetchEventExperience,
  prefetchProfileExperience,
} from "./intentPrefetch";
import type { ProjectionPrefetchSource } from "./prefetchRegistry";

export const DEFAULT_INTENT_TARGETS = 6;

export type NextStepTargetCandidate = {
  eventId: string;
  imageItem: unknown;
  clubUsername: string;
  ownerUsername?: string;
};

interface CollectNextStepTargetBatchParams {
  candidates: NextStepTargetCandidate[];
  eventPrefetchMode?: "album" | "detail";
  maxTargets?: number;
  prefetchedTargets: Set<string>;
  prioritizeProfiles?: boolean;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}

export function collectNextStepTargetBatch(params: CollectNextStepTargetBatchParams) {
  const tasks: Promise<unknown>[] = [];
  const imageItems = params.candidates.map((candidate) => candidate.imageItem);
  const maxTargets = Math.max(0, params.maxTargets ?? DEFAULT_INTENT_TARGETS);
  const prefetchEvent = resolveEventPrefetch(params.eventPrefetchMode);

  for (const candidate of params.candidates) {
    const queueProfiles = () => {
      queueProfilePrefetch({
        maxTargets,
        prefetchedTargets: params.prefetchedTargets,
        queryClient: params.queryClient,
        sourceUsername: candidate.clubUsername,
        tasks,
        viewerId: params.viewerId,
        viewerKey: params.viewerKey,
        viewerUsername: params.viewerUsername,
      });
      queueProfilePrefetch({
        maxTargets,
        prefetchedTargets: params.prefetchedTargets,
        queryClient: params.queryClient,
        sourceUsername: candidate.ownerUsername,
        skipUsername: candidate.clubUsername,
        tasks,
        viewerId: params.viewerId,
        viewerKey: params.viewerKey,
        viewerUsername: params.viewerUsername,
      });
    };
    const queueEvent = () =>
      queueEventPrefetch({
        eventId: candidate.eventId,
        maxTargets,
        prefetchedTargets: params.prefetchedTargets,
        prefetchEvent,
        queryClient: params.queryClient,
        source: params.source,
        tasks,
        viewerId: params.viewerId,
        viewerKey: params.viewerKey,
      });

    if (params.prioritizeProfiles) {
      queueProfiles();
      queueEvent();
      continue;
    }

    queueEvent();
    queueProfiles();
  }

  return { imageItems, tasks };
}

export async function settleNextStepTasks(tasks: Promise<unknown>[]) {
  for (const task of tasks) {
    await task.catch((error) => {
      debugWarn("PROJECTIONS/PREFETCH", "next-step-target-prefetch-failed", {
        message: String(
          (error as { message?: string } | null)?.message || "next-step-target-prefetch-failed",
        ),
      });
    });
  }
}

function queueEventPrefetch(params: {
  eventId: string;
  maxTargets: number;
  prefetchedTargets: Set<string>;
  prefetchEvent: typeof prefetchEventExperience;
  queryClient: QueryClient;
  source?: ProjectionPrefetchSource;
  tasks: Promise<unknown>[];
  viewerId?: string;
  viewerKey: string;
}) {
  if (
    !params.eventId ||
    params.tasks.length >= params.maxTargets ||
    params.prefetchedTargets.has(`event:${params.eventId}`)
  ) {
    return;
  }

  params.prefetchedTargets.add(`event:${params.eventId}`);
  params.tasks.push(
    params.prefetchEvent({
      eventId: params.eventId,
      queryClient: params.queryClient,
      source: params.source || "intent",
      viewerId: params.viewerId,
      viewerKey: params.viewerKey,
    }),
  );
}

function queueProfilePrefetch(params: {
  maxTargets: number;
  prefetchedTargets: Set<string>;
  queryClient: QueryClient;
  sourceUsername?: string;
  skipUsername?: string;
  tasks: Promise<unknown>[];
  viewerId?: string;
  viewerKey: string;
  viewerUsername: string;
}) {
  if (
    !params.sourceUsername ||
    params.sourceUsername === params.skipUsername ||
    params.tasks.length >= params.maxTargets ||
    params.prefetchedTargets.has(`profile:${params.sourceUsername}`)
  ) {
    return;
  }

  params.prefetchedTargets.add(`profile:${params.sourceUsername}`);
  params.tasks.push(
    prefetchProfileExperience({
      queryClient: params.queryClient,
      username: params.sourceUsername,
      viewerId: params.viewerId,
      viewerKey: params.viewerKey,
      viewerUsername: params.viewerUsername,
    }),
  );
}

function resolveEventPrefetch(mode: "album" | "detail" | undefined) {
  return mode === "album" ? prefetchAlbumViewExperience : prefetchEventExperience;
}
