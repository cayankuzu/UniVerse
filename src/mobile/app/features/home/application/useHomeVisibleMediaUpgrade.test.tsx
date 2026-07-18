import { act, renderHook } from "@testing-library/react-native";
import { useHomeVisibleMediaUpgrade } from "./useHomeVisibleMediaUpgrade";

const mockPreloadMediaSources = jest.fn(async (_uris: unknown[], _options?: unknown) => 1);

jest.mock("../../../shared/media/preloadMediaSources", () => ({
  preloadMediaSources: (uris: unknown[], options?: unknown) =>
    mockPreloadMediaSources(uris, options),
}));

describe("useHomeVisibleMediaUpgrade", () => {
  beforeEach(() => {
    mockPreloadMediaSources.mockClear();
  });

  it("eagerly upgrades first-fold media, tracks visible rows, and resets by viewer scope", () => {
    const onViewableItemsChanged = jest.fn();
    const { result, rerender } = renderHook(
      (props: { filterScope: string; viewerKey: string }) =>
        useHomeVisibleMediaUpgrade({
          allowMediaUpgrade: true,
          filterScope: props.filterScope,
          items: [
            {
              id: "event-first-fold",
              kind: "event",
              event: {
                id: "event-first-fold",
                image: "events/event-first-fold/cover.jpg",
              },
            } as never,
          ],
          onViewableItemsChanged,
          viewerKey: props.viewerKey,
        }),
      { initialProps: { filterScope: "all", viewerKey: "viewer-1" } },
    );

    expect(result.current.readyMediaRowKeys.has("event:event-first-fold")).toBe(true);
    expect(mockPreloadMediaSources).toHaveBeenCalledWith(
      ["events/event-first-fold/cover.jpg"],
      expect.objectContaining({ priority: "eager" }),
    );

    const info = {
      changed: [],
      viewableItems: [{ item: { id: "event-1", kind: "event" } }],
    } as never;
    act(() => result.current.onViewableItemsChanged(info));
    expect(onViewableItemsChanged).toHaveBeenCalledWith(info);
    expect(result.current.readyMediaRowKeys.has("event:event-1")).toBe(true);

    rerender({ filterScope: "clubs", viewerKey: "viewer-2" });
    expect(result.current.readyMediaRowKeys.has("event:event-1")).toBe(false);
    expect(result.current.readyMediaRowKeys.has("event:event-first-fold")).toBe(true);
  });
});
