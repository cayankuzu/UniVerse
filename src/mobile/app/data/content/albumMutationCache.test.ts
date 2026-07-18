import { QueryClient } from "@tanstack/react-query";
import { patchAlbumMutationCaches, removeAlbumMutationCaches } from "./albumMutationCache";
import { projectionKeys } from "../projections/projectionKeys";

type AlbumPatchShape = {
  id?: string;
  liked: boolean;
  likes: number;
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("albumMutationCache", () => {
  it("patches album-event and search entities without touching unrelated screens", () => {
    const queryClient = createQueryClient();
    const homeKey = projectionKeys.home("viewer-1", "all:all:all:newest");
    const searchKey = projectionKeys.search("albums", "viewer-1", '{"q":""}');
    const albumEventKey = projectionKeys.albumEvent("event-1", "viewer-1");
    const unrelatedKey = projectionKeys.search("albums", "viewer-1", '{"q":"other"}');

    queryClient.setQueryData(homeKey, {
      deltaToken: null,
      ids: ["album:photo-1"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 10,
    });
    queryClient.setQueryData(searchKey, {
      deltaToken: null,
      ids: ["photo-1"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 20,
    });
    queryClient.setQueryData(albumEventKey, {
      deltaToken: null,
      ids: ["photo-1"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 30,
    });
    queryClient.setQueryData(unrelatedKey, {
      deltaToken: null,
      ids: ["photo-2"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 40,
    });
    queryClient.setQueryData(["entity", "search-albums", "photo-1"], {
      id: "photo-1",
      liked: false,
      likes: 2,
    });
    queryClient.setQueryData(["entity", "profile-albums", "photo-1"], {
      id: "photo-1",
      liked: false,
      likes: 2,
    });
    queryClient.setQueryData(["entity", "home-feed", "album:photo-1"], {
      album: {
        id: "photo-1",
        liked: false,
        likes: 2,
      },
      id: "album:photo-1",
      kind: "album",
    });
    queryClient.setQueryData(projectionKeys.entity("album-event", "photo-1"), {
      id: "photo-1",
      liked: false,
      likes: 2,
    });

    patchAlbumMutationCaches<AlbumPatchShape>({
      eventId: "event-1",
      patch: {
        liked: true,
        likes: 3,
      },
      photoId: "photo-1",
      queryClient,
    });

    expect(queryClient.getQueryData(["entity", "search-albums", "photo-1"])).toMatchObject({
      id: "photo-1",
      liked: true,
      likes: 3,
    });
    expect(queryClient.getQueryData(["entity", "profile-albums", "photo-1"])).toMatchObject({
      id: "photo-1",
      liked: true,
      likes: 3,
    });
    expect(queryClient.getQueryData(["entity", "home-feed", "album:photo-1"])).toMatchObject({
      album: {
        id: "photo-1",
        liked: true,
        likes: 3,
      },
    });
    expect(queryClient.getQueryData(projectionKeys.entity("album-event", "photo-1"))).toMatchObject(
      {
        id: "photo-1",
        liked: true,
        likes: 3,
      },
    );
    expect((queryClient.getQueryData(homeKey) as { touchedAt: number }).touchedAt).not.toBe(10);
    expect((queryClient.getQueryData(searchKey) as { touchedAt: number }).touchedAt).not.toBe(20);
    expect((queryClient.getQueryData(albumEventKey) as { touchedAt: number }).touchedAt).not.toBe(
      30,
    );
    expect((queryClient.getQueryData(unrelatedKey) as { touchedAt: number }).touchedAt).toBe(40);
  });

  it("removes album projections immediately and decrements the event album count", () => {
    const queryClient = createQueryClient();
    const homeKey = projectionKeys.home("viewer-1", "all:all:all:newest");
    const searchKey = projectionKeys.search("albums", "viewer-1", '{"q":""}');
    const profileKey = projectionKeys.profileContent("viewer", "album", "viewer-1");
    const albumEventKey = projectionKeys.albumEvent("event-1", "viewer-1");

    queryClient.setQueryData(homeKey, {
      deltaToken: null,
      ids: ["album:photo-1", "album:photo-2"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 10,
    });
    queryClient.setQueryData(searchKey, {
      deltaToken: null,
      ids: ["photo-1", "photo-2"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 20,
    });
    queryClient.setQueryData(profileKey, {
      deltaToken: null,
      ids: ["photo-1", "photo-2"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 30,
    });
    queryClient.setQueryData(albumEventKey, {
      deltaToken: null,
      ids: ["photo-1", "photo-2"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 40,
    });
    queryClient.setQueryData(["entity", "home-feed", "album:photo-1"], {
      album: { id: "photo-1" },
      id: "album:photo-1",
      kind: "album",
    });
    queryClient.setQueryData(["entity", "profile-albums", "photo-1"], { id: "photo-1" });
    queryClient.setQueryData(["entity", "search-albums", "photo-1"], { id: "photo-1" });
    queryClient.setQueryData(projectionKeys.entity("album-event", "photo-1"), { id: "photo-1" });
    queryClient.setQueryData(projectionKeys.entity("event-detail", "event-1"), {
      albumCount: 2,
      event: {
        albumCount: 2,
        id: "event-1",
      },
      id: "event-1",
    });

    removeAlbumMutationCaches({
      eventId: "event-1",
      photoId: "photo-1",
      queryClient,
    });

    expect((queryClient.getQueryData(homeKey) as { ids: string[] }).ids).toEqual(["album:photo-2"]);
    expect((queryClient.getQueryData(searchKey) as { ids: string[] }).ids).toEqual(["photo-2"]);
    expect((queryClient.getQueryData(profileKey) as { ids: string[] }).ids).toEqual(["photo-2"]);
    expect((queryClient.getQueryData(albumEventKey) as { ids: string[] }).ids).toEqual(["photo-2"]);
    expect(queryClient.getQueryData(["entity", "home-feed", "album:photo-1"])).toBeUndefined();
    expect(queryClient.getQueryData(["entity", "profile-albums", "photo-1"])).toBeUndefined();
    expect(queryClient.getQueryData(["entity", "search-albums", "photo-1"])).toBeUndefined();
    expect(
      queryClient.getQueryData(projectionKeys.entity("album-event", "photo-1")),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(projectionKeys.entity("event-detail", "event-1")),
    ).toMatchObject({
      albumCount: 1,
      event: {
        albumCount: 1,
      },
    });
  });
});
