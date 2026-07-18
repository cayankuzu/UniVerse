import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { logProjectionMetric, logScreenView } from "../../platform/observability";
import { projectionKeys } from "./projectionKeys";
import { createProjectionScreenState } from "./projectionMerge";
import {
  clearProjectionPrefetchRegistry,
  noteProjectionPrefetch,
} from "./prefetch/prefetchRegistry";
import { useProjectionScreen } from "./screen/useProjectionScreen";

jest.mock("../../platform/observability", () => ({
  logEvent: jest.fn(),
  logProjectionMetric: jest.fn(),
  logScreenView: jest.fn(),
  startObservedTimer: () => jest.fn(),
}));

type Item = { id: string; title: string };

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("useProjectionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearProjectionPrefetchRegistry();
  });

  it("shows an initial skeleton while the first fetch is pending without cache", async () => {
    const queryClient = createQueryClient();
    let resolveFetch: ((value: unknown) => void) | null = null;
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useProjectionScreen<Item>({
          entity: "home-feed",
          fetchProjection: () =>
            new Promise((resolve) => {
              resolveFetch = resolve;
            }) as Promise<any>,
          policy: { firstOpenPolicy: "skeleton", refreshMode: "delta" },
          queryKey: ["screen", "home", "viewer"],
        }),
      { wrapper },
    );

    expect(result.current.shouldShowInitialSkeleton).toBe(true);

    await act(async () => {
      resolveFetch?.({
        items: [{ id: "1", title: "One" }],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      });
    });

    await waitFor(() => {
      expect(result.current.items).toEqual([{ id: "1", title: "One" }]);
    });
    expect(result.current.shouldShowInitialSkeleton).toBe(false);
    expect(logProjectionMetric).toHaveBeenCalledWith({
      meta: {
        cachedIds: 0,
        entity: "home-feed",
        hadCache: false,
        rate: 0,
      },
      name: "cache_hit_rate",
      screenKey: '["screen","home","viewer"]',
      status: "skipped",
    });
    expect(logProjectionMetric).toHaveBeenCalledWith({
      meta: {
        deletedCount: 0,
        entity: "home-feed",
        hadCache: false,
        itemCount: 1,
        mode: "replace",
        payloadSize: 1,
        updatedCount: 0,
      },
      name: "delta_payload_size",
      screenKey: '["screen","home","viewer"]',
      status: "ok",
    });
    expect(logScreenView).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "time_to_first_network_patch",
        screenKey: '["screen","home","viewer"]',
        status: "ok",
      }),
    );
    expect(logScreenView).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "time_to_interactive",
        screenKey: '["screen","home","viewer"]',
        status: "ok",
      }),
    );
  });

  it("hydrates from cache first and keeps background refreshes on delta mode", async () => {
    const queryClient = createQueryClient();
    const fetchProjection = jest.fn().mockResolvedValue({
      deltaToken: "delta-2",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:10.000Z",
      updatedItems: [{ id: "1", title: "Fresh" }],
    });
    const queryKey = projectionKeys.home("viewer", "all:all:all:newest");
    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        ids: ["1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
        deltaToken: "delta-1",
      }),
    );
    queryClient.setQueryData(projectionKeys.entity("home-feed", "1"), {
      id: "1",
      title: "Cached",
    });
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useProjectionScreen<Item>({
          entity: "home-feed",
          fetchProjection,
          policy: { refreshMode: "delta" },
          queryKey,
          staleTime: 0,
        }),
      { wrapper },
    );

    expect(result.current.items).toEqual([{ id: "1", title: "Cached" }]);
    expect(result.current.shouldShowInitialSkeleton).toBe(false);

    await act(async () => {
      await result.current.onBackgroundRefresh();
    });

    expect(fetchProjection).toHaveBeenCalledWith({
      cursor: null,
      deltaToken: "delta-1",
      limit: 33,
      mode: "delta",
      since: "2026-03-12T00:00:00.000Z",
    });
    expect(logProjectionMetric).toHaveBeenCalledWith({
      meta: {
        cachedIds: 1,
        entity: "home-feed",
        hadCache: true,
        rate: 1,
      },
      name: "cache_hit_rate",
      screenKey: '["screen","home","viewer","all:all:all:newest"]',
      status: "ok",
    });
    expect(logScreenView).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "time_to_first_cached_content",
        screenKey: '["screen","home","viewer","all:all:all:newest"]',
        status: "ok",
      }),
    );
    await waitFor(() => {
      expect(logScreenView).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "time_to_interactive",
          screenKey: '["screen","home","viewer","all:all:all:newest"]',
          status: "ok",
        }),
      );
    });
  });

  it("marks first network patch as skipped when cache satisfies the screen before any fetch", async () => {
    const queryClient = createQueryClient();
    const fetchProjection = jest.fn().mockResolvedValue({
      deltaToken: "delta-2",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:10.000Z",
      updatedItems: [],
    });
    const queryKey = projectionKeys.home("viewer", "all:all:all:newest");
    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        ids: ["1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
        deltaToken: "delta-1",
      }),
    );
    queryClient.setQueryData(projectionKeys.entity("home-feed", "1"), {
      id: "1",
      title: "Cached",
    });
    const wrapper = createWrapper(queryClient);

    renderHook(
      () =>
        useProjectionScreen<Item>({
          entity: "home-feed",
          fetchProjection,
          policy: { refreshMode: "delta" },
          queryKey,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(logScreenView).toHaveBeenCalledWith({
        durationMs: 0,
        meta: {
          entity: "home-feed",
          hadCache: true,
          reason: "cache-satisfied-before-network",
        },
        name: "time_to_first_network_patch",
        screenKey: '["screen","home","viewer","all:all:all:newest"]',
        status: "skipped",
      });
    });
    expect(fetchProjection).not.toHaveBeenCalled();
  });

  it("repairs an empty cached snapshot immediately on mount", async () => {
    const queryClient = createQueryClient();
    let resolveFetch: ((value: unknown) => void) | null = null;
    const fetchProjection = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const queryKey = projectionKeys.notifications("viewer", "all");
    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        ids: [],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
        deltaToken: "delta-1",
      }),
    );
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useProjectionScreen<Item>({
          entity: "notifications",
          fetchProjection,
          policy: { firstOpenPolicy: "skeleton", refreshMode: "delta" },
          queryKey,
          staleTime: 0,
        }),
      { wrapper },
    );

    expect(result.current.shouldShowInitialSkeleton).toBe(true);

    await waitFor(() => {
      expect(fetchProjection).toHaveBeenCalledWith({
        cursor: null,
        deltaToken: null,
        limit: 33,
        mode: "replace",
        since: null,
      });
    });

    await act(async () => {
      resolveFetch?.({
        deltaToken: "delta-2",
        items: [],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:10.000Z",
        updatedItems: [],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.shouldShowInitialSkeleton).toBe(false);
    });
    expect(logProjectionMetric).toHaveBeenCalledWith({
      meta: {
        cachedIds: 0,
        entity: "notifications",
        hadCache: true,
        rate: 1,
      },
      name: "cache_hit_rate",
      screenKey: '["screen","notifications","viewer","all"]',
      status: "ok",
    });
  });

  it("forces a replace refresh when the cached projection requests it", async () => {
    const queryClient = createQueryClient();
    const fetchProjection = jest.fn().mockResolvedValue({
      deltaToken: "delta-2",
      items: [{ id: "1", title: "Fresh" }],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:10.000Z",
      updatedItems: [],
    });
    const queryKey = projectionKeys.home("viewer", "all:all:all:newest");
    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        deltaToken: "delta-1",
        forceRefreshMode: "replace",
        ids: ["1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(projectionKeys.entity("home-feed", "1"), {
      id: "1",
      title: "Cached",
    });
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useProjectionScreen<Item>({
          entity: "home-feed",
          fetchProjection,
          policy: { refreshMode: "delta" },
          queryKey,
          staleTime: 0,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.onRefresh();
    });

    expect(fetchProjection).toHaveBeenCalledWith({
      cursor: null,
      deltaToken: null,
      limit: 33,
      mode: "replace",
      since: null,
    });
    expect(queryClient.getQueryData(queryKey)).toMatchObject({
      forceRefreshMode: null,
      ids: ["1"],
    });
  });

  it("joins duplicate load-more requests instead of fetching the same page twice", async () => {
    const queryClient = createQueryClient();
    let resolveFetch: ((value: unknown) => void) | null = null;
    const fetchProjection = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: "1", title: "One" }],
        nextCursor: "cursor-2",
        serverTime: "2026-03-12T00:00:00.000Z",
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );
    const queryKey = projectionKeys.home("viewer", "all:all:all:newest");
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useProjectionScreen<Item>({
          entity: "home-feed",
          fetchProjection,
          policy: { refreshMode: "replace" },
          queryKey,
          staleTime: 0,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.items).toEqual([{ id: "1", title: "One" }]);
    });

    let firstPromise: Promise<unknown> | null = null;
    let secondPromise: Promise<unknown> | null = null;
    act(() => {
      firstPromise = result.current.loadMore();
      secondPromise = result.current.loadMore();
    });

    expect(firstPromise).toBe(secondPromise);
    expect(fetchProjection).toHaveBeenCalledTimes(2);
    expect(logProjectionMetric).toHaveBeenCalledWith({
      meta: {
        entity: "home-feed",
        reason: "load-more-joined-in-flight",
      },
      name: "duplicate_request_count",
      screenKey: '["screen","home","viewer","all:all:all:newest"]',
      status: "ok",
    });

    await act(async () => {
      resolveFetch?.({
        items: [{ id: "2", title: "Two" }],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:05.000Z",
      });
      await firstPromise;
    });

    expect(result.current.items).toEqual([
      { id: "1", title: "One" },
      { id: "2", title: "Two" },
    ]);
  });

  it("records prefetch hits when a screen opens from warmup-seeded cache", async () => {
    const queryClient = createQueryClient();
    const queryKey = projectionKeys.notifications("viewer", "all");
    queryClient.setQueryData(
      queryKey,
      createProjectionScreenState({
        ids: ["1"],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      }),
    );
    queryClient.setQueryData(projectionKeys.entity("notifications", "1"), {
      id: "1",
      title: "Cached",
    });
    noteProjectionPrefetch({
      queryKey,
      source: "warmup",
      status: "network",
    });
    const wrapper = createWrapper(queryClient);

    renderHook(
      () =>
        useProjectionScreen<Item>({
          entity: "notifications",
          fetchProjection: jest.fn().mockResolvedValue({
            items: [],
            nextCursor: null,
            serverTime: "2026-03-12T00:00:10.000Z",
            updatedItems: [],
          }),
          policy: { refreshMode: "delta" },
          queryKey,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(logProjectionMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "prefetch_hit_rate",
          screenKey: '["screen","notifications","viewer","all"]',
        }),
      );
    });
    expect(logProjectionMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "warmup_usefulness_rate",
        screenKey: '["screen","notifications","viewer","all"]',
      }),
    );
  });
});
