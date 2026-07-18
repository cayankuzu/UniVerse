import { renderHook, waitFor } from "@testing-library/react-native";
import { useNextPageImagePrefetch } from "./useNextPageImagePrefetch";

const mockPreloadMediaSources = jest.fn(async (uris: string[], _options?: unknown) => uris.length);

jest.mock("../../../shared/media/preloadMediaSources", () => ({
  preloadMediaSources: (uris: string[], options?: unknown) =>
    mockPreloadMediaSources(uris, options),
}));

jest.mock("../networkAwareBudget", () => ({
  resolveNetworkBudget: jest.fn(() => ({ allowImagePrefetch: true })),
}));

jest.mock("../dataLoadingTelemetry", () => ({
  logNextPageImagePrefetch: jest.fn(),
  logPerformanceBudgetTrim: jest.fn(),
}));

describe("useNextPageImagePrefetch", () => {
  beforeEach(() => {
    mockPreloadMediaSources.mockClear();
  });

  it("starts caching newly appended raw images without waiting for another interaction", async () => {
    const firstItem = { id: "event-1", image: "events/event-1/cover.jpg" };
    const secondItem = { id: "event-2", image: "events/event-2/cover.jpg" };
    const { rerender } = renderHook(
      ({ items }: { items: Array<typeof firstItem> }) =>
        useNextPageImagePrefetch({ items, screenKey: "search:events", tier: "tier1" }),
      { initialProps: { items: [firstItem] } },
    );

    rerender({ items: [firstItem, secondItem] });

    await waitFor(() => {
      expect(mockPreloadMediaSources).toHaveBeenCalledWith(
        ["events/event-2/cover.jpg"],
        expect.objectContaining({ priority: "eager" }),
      );
    });
  });
});
