import { act, renderHook } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import {
  clampPageProgress,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
  usePagerController,
  useProgrammaticScrollGuard,
} from "./swipeableTabPagerController";

describe("swipeableTabPagerController", () => {
  it("handles empty, invalid, threshold and lazy-render boundaries", () => {
    expect(clampPageProgress(Number.NaN, 2)).toBe(0);
    expect(clampPageProgress(1, 0)).toBe(0);
    expect(clampPageProgress(-2, 2)).toBe(0);
    expect(clampPageProgress(8, 2)).toBe(1);
    expect(resolvePagedScrollIndex(0, 4, 0)).toBe(0);
    expect(resolvePagedScrollIndex(0.07, 0, 2)).toBe(0);
    expect(resolvePagedScrollIndex(0.08, 0, 2)).toBe(1);
    expect(resolvePagedScrollIndex(0.91, 1, 2)).toBe(0);
    expect(shouldRenderPagedItem(3, 0, false, true, 2)).toBe(false);
    expect(shouldRenderPagedItem(2, 0, false, true, 2)).toBe(true);
  });

  it("starts, replaces, settles and automatically clears programmatic scroll guards", () => {
    jest.useFakeTimers();
    const { result, unmount } = renderHook(() => useProgrammaticScrollGuard());

    act(() => result.current.begin());
    expect(result.current.programmaticScrollRef.current).toBe(true);
    act(() => result.current.begin());
    act(() => jest.advanceTimersByTime(700));
    expect(result.current.programmaticScrollRef.current).toBe(false);

    act(() => result.current.begin());
    act(() => result.current.end());
    expect(result.current.programmaticScrollRef.current).toBe(false);

    act(() => result.current.begin());
    unmount();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("coordinates previews, progress, selection, announcements and external tab sync", () => {
    const tabs = ["albums", "events"] as const;
    const onChange = jest.fn();
    const onPageProgressChange = jest.fn();
    const onPreviewTabChange = jest.fn();
    const announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
    let activeIndex = 0;
    let activeTab: (typeof tabs)[number] = "albums";
    const { result, rerender } = renderHook(() =>
      usePagerController({
        activeIndex,
        activeTab,
        onChange,
        onPageProgressChange,
        onPreviewTabChange,
        tabs,
      }),
    );

    act(() => result.current.emitPreviewIndex(1));
    expect(result.current.renderWindowIndex).toBe(1);
    expect(onPreviewTabChange).toHaveBeenLastCalledWith("events");
    act(() => result.current.emitPreviewIndex(1));
    expect(onPreviewTabChange).toHaveBeenCalledTimes(1);

    act(() => result.current.emitPageProgress(8));
    expect(onPageProgressChange).toHaveBeenLastCalledWith(1);
    act(() => result.current.settleTabIndex(1, true));
    expect(result.current.currentPageRef.current).toBe(1);
    expect(onChange).toHaveBeenLastCalledWith("events");
    expect(announce).toHaveBeenLastCalledWith("events sekmesi, 2/2");

    activeIndex = 1;
    activeTab = "events";
    rerender({});
    act(() => result.current.settleTabIndex(1, true));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => result.current.syncActiveIndex());
    expect(result.current.renderWindowIndex).toBe(1);
    expect(onPreviewTabChange).toHaveBeenLastCalledWith("events");

    announce.mockRestore();
  });

  it("ignores selections when no tab exists", () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      usePagerController({
        activeIndex: 0,
        activeTab: "albums",
        onChange,
        tabs: [] as readonly string[],
      }),
    );

    act(() => result.current.emitPreviewIndex(3));
    act(() => result.current.settleTabIndex(3, true));
    act(() => result.current.syncActiveIndex());
    expect(onChange).not.toHaveBeenCalled();
  });
});
