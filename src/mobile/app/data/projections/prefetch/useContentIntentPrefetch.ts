import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getViewerKey } from "../../contracts/viewerKey";
import { prefetchEventExperience, prefetchProfileExperience } from "./intentPrefetch";

type ViewerIdentity = {
  id?: string;
  username?: string;
};

export function useContentIntentPrefetch(viewer: ViewerIdentity = {}) {
  const queryClient = useQueryClient();
  const viewerKey = getViewerKey({
    id: viewer.id,
    username: viewer.username,
  });
  const viewerUsername = String(viewer.username || "")
    .trim()
    .toLowerCase();

  const prefetchEventById = useCallback(
    (eventId: string) => {
      const normalizedEventId = String(eventId || "").trim();
      if (!normalizedEventId) return null;
      return prefetchEventExperience({
        eventId: normalizedEventId,
        queryClient,
        source: "intent",
        viewerId: viewer.id,
        viewerKey,
      });
    },
    [queryClient, viewer.id, viewerKey],
  );

  const prefetchProfileByUsername = useCallback(
    (username: string) => {
      const normalizedUsername = String(username || "")
        .trim()
        .toLowerCase();
      if (!normalizedUsername || !viewerUsername) return null;
      return prefetchProfileExperience({
        queryClient,
        username: normalizedUsername,
        viewerId: viewer.id,
        viewerKey,
        viewerUsername,
      });
    },
    [queryClient, viewer.id, viewerKey, viewerUsername],
  );

  return {
    prefetchEventById,
    prefetchProfileByUsername,
  };
}
