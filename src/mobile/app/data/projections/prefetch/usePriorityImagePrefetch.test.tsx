import { renderHook, waitFor } from "@testing-library/react-native";
import { usePriorityImagePrefetch } from "./usePriorityImagePrefetch";

const mockPreloadMediaSources = jest.fn(async (uris: string[], _options?: unknown) => uris.length);

jest.mock("../../../shared/media/preloadMediaSources", () => ({
  preloadMediaSources: (uris: string[], options?: unknown) =>
    mockPreloadMediaSources(uris, options),
}));

jest.mock("../networkAwareBudget", () => ({
  resolveNetworkBudget: jest.fn(() => ({ allowImagePrefetch: true })),
}));

jest.mock("../dataLoadingTelemetry", () => ({
  logPerformanceBudgetTrim: jest.fn(),
}));

describe("usePriorityImagePrefetch", () => {
  beforeEach(() => {
    mockPreloadMediaSources.mockClear();
  });

  it("eagerly preloads raw first-fold images when variants are absent", async () => {
    renderHook(() =>
      usePriorityImagePrefetch({
        items: [{ image: "events/event-1/raw-cover.jpg" }],
        scopeKey: "home:first-fold",
        tier: "tier1",
      }),
    );

    await waitFor(() => {
      expect(mockPreloadMediaSources).toHaveBeenCalledWith(
        ["events/event-1/raw-cover.jpg"],
        expect.objectContaining({ priority: "eager" }),
      );
    });
  });

  it("does not send a raw video through the image preloader", async () => {
    renderHook(() =>
      usePriorityImagePrefetch({
        items: [{ image: "events/event-2/cover.mp4" }],
        scopeKey: "home:video-first-fold",
        tier: "tier1",
      }),
    );

    await waitFor(() => {
      expect(mockPreloadMediaSources).not.toHaveBeenCalled();
    });
  });
});
