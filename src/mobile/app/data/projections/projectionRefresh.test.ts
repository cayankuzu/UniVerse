import { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "./projectionKeys";
import { refreshViewerPrivacySensitiveScreens, replaceProjectionScope } from "./projectionRefresh";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("projection refresh helpers", () => {
  it("soft refreshes privacy-sensitive projection scopes without deleting cached state", () => {
    const queryClient = createQueryClient();
    const viewerKey = "viewer-1";
    const username = "açık-kulüp";

    const seededKeys = [
      projectionKeys.home(viewerKey, "all:all:all:newest"),
      projectionKeys.search("albums", viewerKey, "discovery"),
      projectionKeys.notifications(viewerKey, "all"),
      projectionKeys.blockedUsers(viewerKey),
      projectionKeys.profileOverview(username, viewerKey),
      projectionKeys.profileScreen(username, "album", viewerKey),
      projectionKeys.profileScreen(username, "events", viewerKey),
      projectionKeys.profileContent(username, "album", viewerKey),
      projectionKeys.profileContent(username, "events", viewerKey),
      projectionKeys.relationships(username, "followers", viewerKey),
      projectionKeys.screen("event-detail", "event-1", viewerKey),
      projectionKeys.screen("album-event", "event-1", viewerKey),
      projectionKeys.eventComments("event-1"),
      projectionKeys.eventLikers("event-1"),
      projectionKeys.eventAttendees("event-1"),
      projectionKeys.albumComments("photo-1"),
    ] as const;

    seededKeys.forEach((key, index) => {
      queryClient.setQueryData(key, { ids: [`seed-${index}`] });
    });

    refreshViewerPrivacySensitiveScreens(queryClient, viewerKey, username);

    seededKeys.forEach((key, index) => {
      expect(queryClient.getQueryData(key)).toMatchObject({
        ids: [`seed-${index}`],
        isStale: true,
      });
    });
  });

  it("marks a projection scope for replace-mode refresh without deleting cached content", () => {
    const queryClient = createQueryClient();
    const homeKey = projectionKeys.home("viewer-1", "all:all:all:newest");

    queryClient.setQueryData(homeKey, {
      deltaToken: "delta-1",
      ids: ["event:1"],
      nextCursor: null,
      serverTime: "2026-03-17T00:00:00.000Z",
    });

    replaceProjectionScope(queryClient, homeKey);

    expect(queryClient.getQueryData(homeKey)).toMatchObject({
      deltaToken: "delta-1",
      forceRefreshMode: "replace",
      ids: ["event:1"],
      isStale: true,
    });
  });
});
