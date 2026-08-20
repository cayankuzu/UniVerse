const mockRunLowPriorityTask = jest.fn((task: () => unknown, _options?: unknown) =>
  Promise.resolve().then(task),
);

jest.mock("../../../shared/utils/lowPriorityTaskScheduler", () => ({
  runLowPriorityTask: (task: () => unknown, options?: unknown) =>
    mockRunLowPriorityTask(task, options),
}));

import { QueryClient } from "@tanstack/react-query";
import { prefetchProjectionScreen } from "./prefetchProjection";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("prefetchProjectionScreen priority", () => {
  beforeEach(() => {
    mockRunLowPriorityTask.mockClear();
  });

  it("starts tab intent immediately instead of waiting behind background work", async () => {
    const fetchProjection = jest.fn(async () => ({
      deltaToken: null,
      items: [{ id: "event-1" }],
      nextCursor: null,
      serverTime: new Date("2026-08-19T12:00:00.000Z").toISOString(),
    }));

    await prefetchProjectionScreen({
      entity: "search-events",
      fetchProjection,
      queryClient: createQueryClient(),
      queryKey: ["screen", "search", "events"],
      source: "tab",
      staleTime: 0,
    });

    expect(fetchProjection).toHaveBeenCalledTimes(1);
    expect(mockRunLowPriorityTask).not.toHaveBeenCalled();
  });

  it("keeps automatic warmup work on the bounded background queue", async () => {
    await prefetchProjectionScreen({
      entity: "notifications",
      fetchProjection: async () => ({
        deltaToken: null,
        items: [],
        nextCursor: null,
        serverTime: new Date("2026-08-19T12:00:00.000Z").toISOString(),
      }),
      queryClient: createQueryClient(),
      queryKey: ["screen", "notifications"],
      source: "warmup",
      staleTime: 0,
    });

    expect(mockRunLowPriorityTask).toHaveBeenCalledTimes(1);
  });
});
