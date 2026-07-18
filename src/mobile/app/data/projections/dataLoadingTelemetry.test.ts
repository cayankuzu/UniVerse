import {
  clearScreenRequestTracking,
  logNetworkBudgetSkip,
  logNextPageImagePrefetch,
  logViewportPrefetchFired,
  trackScreenRequest,
} from "./dataLoadingTelemetry";

const mockLogProjectionMetric = jest.fn();
jest.mock("../../platform/observability", () => ({
  logProjectionMetric: (...args: unknown[]) => mockLogProjectionMetric(...args),
}));

describe("dataLoadingTelemetry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearScreenRequestTracking("test-screen");
  });

  describe("trackScreenRequest", () => {
    it("does not log waterfall for fewer than 3 requests", () => {
      trackScreenRequest("test-screen", "sync:replace");
      trackScreenRequest("test-screen", "sync:delta");
      expect(mockLogProjectionMetric).not.toHaveBeenCalled();
    });

    it("logs waterfall when 3+ requests fire within the window", () => {
      trackScreenRequest("test-screen", "req-1");
      trackScreenRequest("test-screen", "req-2");
      trackScreenRequest("test-screen", "req-3");
      expect(mockLogProjectionMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "request_waterfall_detected",
          screenKey: "test-screen",
          status: "ok",
        }),
      );
    });

    it("clears tracking state after clearScreenRequestTracking", () => {
      trackScreenRequest("test-screen", "req-1");
      trackScreenRequest("test-screen", "req-2");
      clearScreenRequestTracking("test-screen");
      trackScreenRequest("test-screen", "req-3");
      // Only 1 request after clear — no waterfall
      expect(mockLogProjectionMetric).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: "request_waterfall_detected" }),
      );
    });
  });

  describe("logNetworkBudgetSkip", () => {
    it("logs a skip event with correct action and quality", () => {
      logNetworkBudgetSkip({
        action: "viewport-prefetch",
        quality: "offline",
        screenKey: "search",
      });
      expect(mockLogProjectionMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: { action: "viewport-prefetch", quality: "offline" },
          name: "network_budget_skip",
          status: "skipped",
        }),
      );
    });
  });

  describe("logNextPageImagePrefetch", () => {
    it("logs image prefetch metrics with ok status when images prefetched", () => {
      logNextPageImagePrefetch({
        newItemCount: 10,
        prefetchedCount: 6,
        screenKey: "home",
        skippedCount: 4,
      });
      expect(mockLogProjectionMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "next_page_image_prefetch",
          status: "ok",
        }),
      );
    });

    it("logs skipped status when zero images prefetched", () => {
      logNextPageImagePrefetch({
        newItemCount: 5,
        prefetchedCount: 0,
        screenKey: "home",
        skippedCount: 5,
      });
      expect(mockLogProjectionMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "next_page_image_prefetch",
          status: "skipped",
        }),
      );
    });
  });

  describe("logViewportPrefetchFired", () => {
    it("logs the correct target count and type", () => {
      logViewportPrefetchFired({
        screenKey: "home-feed",
        targetCount: 2,
        targetType: "event",
      });
      expect(mockLogProjectionMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: { targetCount: 2, targetType: "event" },
          name: "viewport_prefetch_fired",
          status: "ok",
        }),
      );
    });
  });
});
