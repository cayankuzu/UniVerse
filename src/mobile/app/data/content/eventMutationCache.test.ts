import { QueryClient } from "@tanstack/react-query";
import { patchEventMutationCaches } from "./eventMutationCache";
import { projectionKeys } from "../projections/projectionKeys";

type EventPatchShape = {
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

describe("eventMutationCache", () => {
  it("patches exact event entities and only touches screens that contain the event", () => {
    const queryClient = createQueryClient();
    const homeKey = projectionKeys.home("viewer-1", "all:all:all:newest");
    const searchKey = projectionKeys.search("events", "viewer-1", '{"q":""}');
    const detailKey = projectionKeys.eventDetail("event-1", "viewer-1");
    const unrelatedKey = projectionKeys.search("events", "viewer-1", '{"q":"other"}');

    queryClient.setQueryData(homeKey, {
      deltaToken: null,
      ids: ["event:event-1"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 10,
    });
    queryClient.setQueryData(searchKey, {
      deltaToken: null,
      ids: ["event-1"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 20,
    });
    queryClient.setQueryData(detailKey, {
      deltaToken: null,
      ids: ["event-1"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 30,
    });
    queryClient.setQueryData(unrelatedKey, {
      deltaToken: null,
      ids: ["event-2"],
      isStale: false,
      nextCursor: null,
      serverTime: null,
      touchedAt: 40,
    });
    queryClient.setQueryData(["entity", "search-events", "event-1"], {
      id: "event-1",
      liked: false,
      likes: 3,
    });
    queryClient.setQueryData(["entity", "profile-events", "event-1"], {
      id: "event-1",
      liked: false,
      likes: 3,
    });
    queryClient.setQueryData(["entity", "home-feed", "event:event-1"], {
      event: {
        id: "event-1",
        liked: false,
        likes: 3,
      },
      id: "event:event-1",
      kind: "event",
    });
    queryClient.setQueryData(projectionKeys.entity("event-detail", "event-1"), {
      event: {
        id: "event-1",
        liked: false,
        likes: 3,
      },
      id: "event-1",
    });

    patchEventMutationCaches<EventPatchShape>({
      eventId: "event-1",
      patch: {
        liked: true,
        likes: 4,
      },
      queryClient,
    });

    expect(queryClient.getQueryData(["entity", "search-events", "event-1"])).toMatchObject({
      id: "event-1",
      liked: true,
      likes: 4,
    });
    expect(queryClient.getQueryData(["entity", "profile-events", "event-1"])).toMatchObject({
      id: "event-1",
      liked: true,
      likes: 4,
    });
    expect(queryClient.getQueryData(["entity", "home-feed", "event:event-1"])).toMatchObject({
      event: {
        id: "event-1",
        liked: true,
        likes: 4,
      },
    });
    expect(
      queryClient.getQueryData(projectionKeys.entity("event-detail", "event-1")),
    ).toMatchObject({
      event: {
        id: "event-1",
        liked: true,
        likes: 4,
      },
    });
    expect((queryClient.getQueryData(homeKey) as { touchedAt: number }).touchedAt).not.toBe(10);
    expect((queryClient.getQueryData(searchKey) as { touchedAt: number }).touchedAt).not.toBe(20);
    expect((queryClient.getQueryData(detailKey) as { touchedAt: number }).touchedAt).not.toBe(30);
    expect((queryClient.getQueryData(unrelatedKey) as { touchedAt: number }).touchedAt).toBe(40);
  });
});
