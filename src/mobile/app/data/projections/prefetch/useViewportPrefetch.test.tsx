import { renderHook } from "@testing-library/react-native";

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: () => ({}),
}));

import { useViewportPrefetch } from "./useViewportPrefetch";

describe("useViewportPrefetch", () => {
  it("keeps FlashList viewability props stable across equivalent renders", () => {
    const resolvePrefetchTargets = () => [];
    const { result, rerender } = renderHook(
      ({ minimumViewTimeMs }: { minimumViewTimeMs: number }) =>
        useViewportPrefetch({
          minimumViewTimeMs,
          resolvePrefetchTargets,
          scopeKey: "home:all",
          viewerKey: "viewer-1",
          viewerUsername: "alice",
          waitForInteraction: false,
        }),
      { initialProps: { minimumViewTimeMs: 120 } },
    );
    const firstCallback = result.current.onViewableItemsChanged;
    const firstConfig = result.current.viewabilityConfig;

    rerender({ minimumViewTimeMs: 120 });

    expect(result.current.onViewableItemsChanged).toBe(firstCallback);
    expect(result.current.viewabilityConfig).toBe(firstConfig);

    rerender({ minimumViewTimeMs: 180 });

    expect(result.current.onViewableItemsChanged).toBe(firstCallback);
    expect(result.current.viewabilityConfig).not.toBe(firstConfig);
  });
});
