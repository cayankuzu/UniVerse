import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { createProjectionScreenState } from "../../../data/projections/projectionMerge";
import type { EventWithMeta } from "../../../data/contracts/content";
import { fetchViewProfileContent } from "../data";
import { useProfileProjectionContentState } from "./useProfileProjectionContentState";

const mockReplaceProjectionScope = jest.fn();

jest.mock("../../../data/projections/projectionRefresh", () => ({
  replaceProjectionScope: (...args: unknown[]) => mockReplaceProjectionScope(...args),
}));

jest.mock("../data", () => ({
  fetchViewProfileContent: jest.fn(),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useProfileProjectionContentState", () => {
  beforeEach(() => {
    mockReplaceProjectionScope.mockClear();
    (fetchViewProfileContent as jest.Mock).mockReset();
  });

  function buildEvent(overrides: Partial<EventWithMeta> = {}): EventWithMeta {
    return {
      access: "",
      address: "",
      attendees: 0,
      capacity: 0,
      categories: [],
      category: "",
      club: "CYN Club",
      clubImage: "",
      clubUserId: "club-1",
      clubUsername: "cyn",
      comments: 0,
      createdAt: "2026-03-20T12:00:00.000Z",
      date: "2026-03-20",
      description: "",
      endDate: "2026-03-20",
      endTime: "",
      fee: "",
      id: "event-1",
      image: "",
      joined: false,
      level: "",
      liked: false,
      likes: 0,
      location: "",
      materials: "",
      startDate: "2026-03-20",
      startTime: "",
      targetAudience: "",
      title: "Launch Event",
      type: "",
      university: "",
      visibility: "public",
      ...overrides,
    };
  }

  it("uses cached event projection items when the active events tab is temporarily empty", () => {
    const queryClient = createQueryClient();
    const queryKey = projectionKeys.profileContent("cyn", "events", "viewer");
    const cachedEvent = buildEvent();

    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        ids: ["event-1"],
        nextCursor: null,
        serverTime: "2026-03-20T12:00:00.000Z",
      }),
    );
    queryClient.setQueryData(projectionKeys.entity("profile-events", "event-1"), cachedEvent);

    const { result } = renderHook(
      () =>
        useProfileProjectionContentState({
          activeItems: [],
          enabled: true,
          expectedEventsCount: 1,
          tab: "events",
          username: "cyn",
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.sourceEvents).toEqual([
      expect.objectContaining({
        clubUsername: "cyn",
        id: "event-1",
        title: "Launch Event",
      }),
    ]);
  });

  it("prefers active event projection items when they are available", () => {
    const queryClient = createQueryClient();
    const activeEvent = buildEvent({
      createdAt: "2026-03-21T12:00:00.000Z",
      date: "2026-03-21",
      endDate: "2026-03-21",
      id: "event-2",
      startDate: "2026-03-21",
      title: "Fresh Event",
    });

    const { result } = renderHook(
      () =>
        useProfileProjectionContentState({
          activeItems: [activeEvent],
          enabled: true,
          expectedEventsCount: 1,
          tab: "events",
          username: "cyn",
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.sourceEvents).toEqual([
      expect.objectContaining({
        clubUsername: "cyn",
        id: "event-2",
        title: "Fresh Event",
      }),
    ]);
  });

  it("keeps available event items visible even when overview counts temporarily drop to zero", () => {
    const queryClient = createQueryClient();
    const queryKey = projectionKeys.profileContent("cyn", "events", "viewer");
    const cachedEvent = buildEvent({
      id: "event-zero-count",
      title: "Zero Count Event",
    });

    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        ids: ["event-zero-count"],
        nextCursor: null,
        serverTime: "2026-03-20T12:00:00.000Z",
      }),
    );
    queryClient.setQueryData(
      projectionKeys.entity("profile-events", "event-zero-count"),
      cachedEvent,
    );

    const { result } = renderHook(
      () =>
        useProfileProjectionContentState({
          activeItems: [],
          enabled: true,
          expectedEventsCount: 0,
          tab: "events",
          username: "cyn",
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.sourceEvents).toEqual([
      expect.objectContaining({
        clubUsername: "cyn",
        id: "event-zero-count",
        title: "Zero Count Event",
      }),
    ]);
  });

  it("requests a replace refresh when cached event items exist but cannot be normalized", async () => {
    const queryClient = createQueryClient();
    const queryKey = projectionKeys.profileContent("cyn", "events", "viewer");

    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        ids: ["event-bad"],
        nextCursor: null,
        serverTime: "2026-03-20T12:00:00.000Z",
      }),
    );
    queryClient.setQueryData(projectionKeys.entity("profile-events", "event-bad"), {
      id: "event-bad",
    });

    renderHook(
      () =>
        useProfileProjectionContentState({
          activeItems: [{ id: "event-bad" } as EventWithMeta],
          enabled: true,
          expectedEventsCount: 1,
          tab: "events",
          username: "cyn",
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(mockReplaceProjectionScope).toHaveBeenCalledWith(queryClient, queryKey);
    });
  });

  it("hydrates the active events tab immediately when counts are positive but the projection is empty", async () => {
    const queryClient = createQueryClient();
    const repairedEvent = buildEvent({
      id: "event-repaired",
      title: "Repaired Event",
    });
    (fetchViewProfileContent as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-events-repair",
      items: [repairedEvent],
      nextCursor: null,
      serverTime: "2026-03-20T12:00:00.000Z",
      updatedItems: [],
    });

    const { result } = renderHook(
      () =>
        useProfileProjectionContentState({
          activeItems: [],
          enabled: true,
          expectedEventsCount: 2,
          tab: "events",
          username: "cyn",
          viewerId: "viewer-1",
          viewerKey: "viewer",
          viewerUsername: "viewer-user",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(fetchViewProfileContent).toHaveBeenCalledWith({
        context: { limit: 33 },
        tab: "events",
        username: "cyn",
        viewerId: "viewer-1",
        viewerUsername: "viewer-user",
      });
    });

    expect(
      queryClient.getQueryData(projectionKeys.profileContent("cyn", "events", "viewer")),
    ).toEqual(
      expect.objectContaining({
        ids: ["event-repaired"],
      }),
    );
    expect(
      queryClient.getQueryData(projectionKeys.entity("profile-events", "event-repaired")),
    ).toEqual(
      expect.objectContaining({
        id: "event-repaired",
        title: "Repaired Event",
      }),
    );
    expect(result.current.sourceEvents).toEqual([]);
  });

  it("upgrades an inactive-tab replace repair to an active-tab hydrate repair", async () => {
    const queryClient = createQueryClient();
    const repairedEvent = buildEvent({
      id: "event-tab-repair",
      title: "Tab Repair Event",
    });
    (fetchViewProfileContent as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-tab-repair",
      items: [repairedEvent],
      nextCursor: null,
      serverTime: "2026-03-20T12:00:00.000Z",
      updatedItems: [],
    });

    const { rerender } = renderHook(
      ({ tab }: { tab: "album" | "events" }) =>
        useProfileProjectionContentState({
          activeItems: [],
          enabled: true,
          expectedAlbumsCount: 1,
          expectedEventsCount: 1,
          tab,
          username: "cyn",
          viewerId: "viewer-1",
          viewerKey: "viewer",
          viewerUsername: "viewer-user",
        }),
      {
        initialProps: { tab: "album" as const },
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(mockReplaceProjectionScope).toHaveBeenCalledWith(
        queryClient,
        projectionKeys.profileContent("cyn", "events", "viewer"),
      );
    });

    rerender({ tab: "events" });

    await waitFor(() => {
      expect(fetchViewProfileContent).toHaveBeenCalledWith({
        context: { limit: 33 },
        tab: "events",
        username: "cyn",
        viewerId: "viewer-1",
        viewerUsername: "viewer-user",
      });
    });
  });
});
