import { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { getViewerRelationshipSnapshotQueryKey } from "../../../data/social/relationshipSnapshot";
import {
  commitProfileFollowMutation,
  rollbackProfileFollowMutation,
} from "./profileFollowMutationPolicy";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("profile follow mutation refresh policy", () => {
  it("keeps projection state but removes unfollowed club items from home", () => {
    const queryClient = createQueryClient();
    const viewerCacheKey = "viewer-1";
    const viewerUsername = "viewer";
    const targetUsername = "hedef-kulup";
    const homeKey = projectionKeys.home(viewerCacheKey, "all:all:all:newest");
    queryClient.setQueryData(homeKey, {
      deltaToken: "seed",
      ids: ["event:target", "event:other"],
      nextCursor: null,
      serverTime: "2026-03-13T00:00:00.000Z",
    });
    queryClient.setQueryData(projectionKeys.entity("home-feed", "event:target"), {
      event: { clubUsername: targetUsername, id: "event-target" },
      id: "event:target",
      kind: "event",
      source: "following",
    });
    queryClient.setQueryData(projectionKeys.entity("home-feed", "event:other"), {
      event: { clubUsername: "diger-kulup", id: "event-other" },
      id: "event:other",
      kind: "event",
      source: "following",
    });

    commitProfileFollowMutation({
      nextStatus: "none",
      previousStatus: "following",
      queryClient,
      targetProfile: {
        accountType: "club",
        isPrivate: false,
      },
      username: targetUsername,
      viewerCacheKey,
      viewerUsername,
    });

    expect(queryClient.getQueryData(homeKey)).toMatchObject({
      forceRefreshMode: "replace",
      ids: ["event:other"],
      isStale: true,
    });
  });

  it("removes requested profiles from home even when the previous client state was not following", () => {
    const queryClient = createQueryClient();
    const viewerCacheKey = "viewer-1";
    const viewerUsername = "viewer";
    const targetUsername = "gizli-hesap";
    const homeKey = projectionKeys.home(viewerCacheKey, "all:all:all:newest");
    queryClient.setQueryData(homeKey, {
      deltaToken: "seed",
      ids: ["event:target", "event:other"],
      nextCursor: null,
      serverTime: "2026-03-13T00:00:00.000Z",
    });
    queryClient.setQueryData(projectionKeys.entity("home-feed", "event:target"), {
      event: { clubUsername: targetUsername, id: "event-target" },
      id: "event:target",
      kind: "event",
      source: "following",
    });
    queryClient.setQueryData(projectionKeys.entity("home-feed", "event:other"), {
      event: { clubUsername: "diger-kulup", id: "event-other" },
      id: "event:other",
      kind: "event",
      source: "following",
    });

    commitProfileFollowMutation({
      nextStatus: "requested",
      previousStatus: "none",
      queryClient,
      targetProfile: {
        accountType: "club",
        isPrivate: true,
      },
      username: targetUsername,
      viewerCacheKey,
      viewerUsername,
    });

    expect(queryClient.getQueryData(homeKey)).toMatchObject({
      forceRefreshMode: "replace",
      ids: ["event:other"],
      isStale: true,
    });
  });

  it("keeps projection state but removes newly-followed student items from search", () => {
    const queryClient = createQueryClient();
    const viewerCacheKey = "viewer-1";
    const viewerUsername = "viewer";
    const targetUsername = "hedef-ogrenci";
    const relationsKey = getViewerRelationshipSnapshotQueryKey({
      viewerId: viewerCacheKey,
      viewerUsername,
    });
    const searchAlbumsKey = projectionKeys.search("albums", viewerCacheKey, "__discovery__:newest");
    const searchEventsKey = projectionKeys.search("events", viewerCacheKey, "__discovery__:newest");
    queryClient.setQueryData(relationsKey, {
      following: [],
      followingClubUsernames: [],
      followingStudentUsernames: [],
      followingUsernames: [],
      viewerId: viewerCacheKey,
      viewerUsername,
    });
    queryClient.setQueryData(searchAlbumsKey, {
      deltaToken: "seed",
      ids: ["album:target", "album:other"],
      nextCursor: null,
      serverTime: "2026-03-13T00:00:00.000Z",
    });
    queryClient.setQueryData(searchEventsKey, {
      deltaToken: "seed",
      ids: ["event:target", "event:other"],
      nextCursor: null,
      serverTime: "2026-03-13T00:00:00.000Z",
    });
    queryClient.setQueryData(projectionKeys.entity("search-albums", "album:target"), {
      eventId: "event-target",
      id: "album:target",
      username: targetUsername,
    });
    queryClient.setQueryData(projectionKeys.entity("search-albums", "album:other"), {
      eventId: "event-other",
      id: "album:other",
      username: "diger-ogrenci",
    });
    queryClient.setQueryData(projectionKeys.entity("search-events", "event:target"), {
      clubUsername: "baska-kulup",
      feedActorUsername: targetUsername,
      id: "event:target",
    });
    queryClient.setQueryData(projectionKeys.entity("search-events", "event:other"), {
      clubUsername: "acik-kulup",
      id: "event:other",
    });

    commitProfileFollowMutation({
      nextStatus: "following",
      previousStatus: "none",
      queryClient,
      targetProfile: {
        accountType: "student",
        isPrivate: false,
      },
      username: targetUsername,
      viewerCacheKey,
      viewerUsername,
    });

    expect(queryClient.getQueryData(searchAlbumsKey)).toMatchObject({
      ids: ["album:other"],
      isStale: true,
    });
    expect(queryClient.getQueryData(searchEventsKey)).toMatchObject({
      ids: ["event:other"],
      isStale: true,
    });
    expect(queryClient.getQueryData(relationsKey)).toMatchObject({
      followingStudentUsernames: [targetUsername],
      followingUsernames: [targetUsername],
    });
  });

  it("clears cached search scopes and removes unfollowed users from the relations snapshot", () => {
    const queryClient = createQueryClient();
    const viewerCacheKey = "viewer-1";
    const viewerUsername = "viewer";
    const targetUsername = "hedef-ogrenci";
    const relationsKey = getViewerRelationshipSnapshotQueryKey({
      viewerId: viewerCacheKey,
      viewerUsername,
    });
    const searchAlbumsKey = projectionKeys.search("albums", viewerCacheKey, "__discovery__:newest");
    const searchStudentsKey = projectionKeys.search(
      "students",
      viewerCacheKey,
      "__discovery__:newest",
    );
    queryClient.setQueryData(relationsKey, {
      following: [
        {
          accountType: "student",
          isPrivate: false,
          username: targetUsername,
        },
      ],
      followingClubUsernames: [],
      followingStudentUsernames: [targetUsername],
      followingUsernames: [targetUsername],
      viewerId: viewerCacheKey,
      viewerUsername,
    });
    queryClient.setQueryData(searchAlbumsKey, {
      ids: ["album:target"],
      nextCursor: null,
      serverTime: "2026-03-13T00:00:00.000Z",
    });
    queryClient.setQueryData(searchStudentsKey, {
      ids: ["user:target"],
      nextCursor: null,
      serverTime: "2026-03-13T00:00:00.000Z",
    });

    commitProfileFollowMutation({
      nextStatus: "none",
      previousStatus: "following",
      queryClient,
      targetProfile: {
        accountType: "student",
        isPrivate: false,
      },
      username: targetUsername,
      viewerCacheKey,
      viewerUsername,
    });

    expect(queryClient.getQueryData(relationsKey)).toMatchObject({
      following: [],
      followingStudentUsernames: [],
      followingUsernames: [],
    });
    expect(queryClient.getQueryData(searchAlbumsKey)).toBeUndefined();
    expect(queryClient.getQueryData(searchStudentsKey)).toBeUndefined();
  });

  it("soft refreshes projections after follow rollback instead of deleting them", () => {
    const queryClient = createQueryClient();
    const viewerCacheKey = "viewer-1";
    const viewerUsername = "viewer";
    const targetUsername = "hedef";

    const refreshedKeys = [
      projectionKeys.home(viewerCacheKey, "all:all:all:newest"),
      projectionKeys.search("albums", viewerCacheKey, "__discovery__:newest"),
      projectionKeys.profileOverview(targetUsername, viewerCacheKey),
      projectionKeys.profileOverview(viewerUsername, viewerCacheKey),
      projectionKeys.relationships(targetUsername, "followers", viewerCacheKey),
      projectionKeys.relationships(targetUsername, "following", viewerCacheKey),
      projectionKeys.profileContent(targetUsername, "album", viewerCacheKey),
      projectionKeys.profileContent(targetUsername, "events", viewerCacheKey),
    ] as const;

    refreshedKeys.forEach((key, index) => {
      queryClient.setQueryData(key, {
        ids: [`seed-${index}`],
        nextCursor: null,
        profile: { followersCount: 1, followingCount: 1 },
        serverTime: "2026-03-13T00:00:00.000Z",
      });
    });
    rollbackProfileFollowMutation({
      previousStatus: "following",
      queryClient,
      rolledBackFromStatus: "none",
      targetProfile: {
        accountType: "club",
        isPrivate: true,
      },
      username: targetUsername,
      viewerCacheKey,
      viewerUsername,
    });

    refreshedKeys.forEach((key, index) => {
      expect(queryClient.getQueryData(key)).toMatchObject({
        ids: [`seed-${index}`],
        isStale: true,
      });
    });
    expect(
      queryClient.getQueryData(projectionKeys.home(viewerCacheKey, "all:all:all:newest")),
    ).toMatchObject({
      forceRefreshMode: "replace",
    });
  });
});
