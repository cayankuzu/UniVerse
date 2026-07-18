import { act, renderHook } from "@testing-library/react-native";
import { useOwnProfileScreenActions } from "./useOwnProfileScreenActions";

function createParams(loadingMore = false) {
  return {
    albums: [{ id: "album-1" }],
    events: [{ id: "event-1" }],
    loadMore: jest.fn(),
    loadingMore,
    openProfile: jest.fn(),
    setViewerIndex: jest.fn(),
    setViewerTargetId: jest.fn(),
    setViewerType: jest.fn(),
  };
}

describe("useOwnProfileScreenActions", () => {
  it("opens known album and event targets with stable indexes", () => {
    const params = createParams();
    const { result } = renderHook(() => useOwnProfileScreenActions(params));

    act(() => {
      result.current.openAlbumAt({ id: "album-1" } as never);
      result.current.openEventAt({ id: "event-1" } as never);
      result.current.openContentProfile("alice");
    });

    expect(params.setViewerTargetId).toHaveBeenNthCalledWith(1, "album-1");
    expect(params.setViewerTargetId).toHaveBeenNthCalledWith(2, "event-1");
    expect(params.setViewerType).toHaveBeenNthCalledWith(1, "albums");
    expect(params.setViewerType).toHaveBeenNthCalledWith(2, "events");
    expect(params.setViewerIndex).toHaveBeenNthCalledWith(1, 0);
    expect(params.setViewerIndex).toHaveBeenNthCalledWith(2, 0);
    expect(params.openProfile).toHaveBeenCalledWith("alice");
  });

  it("ignores missing targets and coalesces load-more while one is active", () => {
    const idle = createParams();
    const busy = createParams(true);
    const idleHook = renderHook(() => useOwnProfileScreenActions(idle));
    const busyHook = renderHook(() => useOwnProfileScreenActions(busy));

    act(() => {
      idleHook.result.current.openAlbumAt({ id: "missing" } as never);
      idleHook.result.current.openEventAt({ id: "" } as never);
      idleHook.result.current.handleLoadMore();
      busyHook.result.current.handleLoadMore();
    });

    expect(idle.setViewerType).not.toHaveBeenCalled();
    expect(idle.loadMore).toHaveBeenCalledTimes(1);
    expect(busy.loadMore).not.toHaveBeenCalled();
  });
});
