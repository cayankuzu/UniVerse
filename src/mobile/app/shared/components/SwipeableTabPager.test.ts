import React, { useEffect } from "react";
import { act, render } from "@testing-library/react-native";
import { FlatList, Text, View } from "react-native";
import { loadNativePagerView } from "./pagerViewAdapter";
import {
  clampPageProgress,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
  SwipeableTabPager,
} from "./SwipeableTabPager";

jest.mock("../hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

jest.mock("./pagerViewAdapter", () => {
  const actual = jest.requireActual("./pagerViewAdapter");
  return { ...actual, loadNativePagerView: jest.fn(() => null) };
});

const mockedLoadNativePagerView = loadNativePagerView as jest.MockedFunction<
  typeof loadNativePagerView
>;

const TABS = ["albums", "events", "clubs", "students"] as const;

describe("SwipeableTabPager", () => {
  beforeEach(() => {
    mockedLoadNativePagerView.mockReset();
    mockedLoadNativePagerView.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves preview index from native page progress", () => {
    expect(resolvePagedScrollIndex(0.04, 0, TABS.length)).toBe(0);
    expect(resolvePagedScrollIndex(0.12, 0, TABS.length)).toBe(1);
    expect(resolvePagedScrollIndex(1.88, 2, TABS.length)).toBe(1);
    expect(resolvePagedScrollIndex(5, 3, TABS.length)).toBe(3);
  });

  it("clamps progress to valid pager bounds", () => {
    expect(clampPageProgress(-1, TABS.length)).toBe(0);
    expect(clampPageProgress(1.4, TABS.length)).toBe(1.4);
    expect(clampPageProgress(99, TABS.length)).toBe(3);
  });

  it("keeps all pages alive or limits lazy render window", () => {
    expect(shouldRenderPagedItem(3, 0, true, true)).toBe(true);
    expect(shouldRenderPagedItem(3, 0, false, false)).toBe(true);
    expect(shouldRenderPagedItem(3, 0, false, true)).toBe(false);
    expect(shouldRenderPagedItem(1, 0, false, true)).toBe(true);
    expect(shouldRenderPagedItem(2, 0, false, true)).toBe(false);
  });

  it("keeps profile pages mounted when the active tab changes", () => {
    const tabs = ["albums", "events"] as const;
    const mounts = { albums: 0, events: 0 };
    function Page({ tab }: { tab: (typeof tabs)[number] }) {
      useEffect(() => {
        mounts[tab] += 1;
      }, [tab]);
      return React.createElement(Text, null, tab);
    }
    const renderPager = (activeTab: (typeof tabs)[number]) =>
      React.createElement(SwipeableTabPager, {
        activeTab,
        keepAlive: true,
        onChange: jest.fn(),
        renderPage: (tab: unknown) =>
          React.createElement(Page, { tab: tab as (typeof tabs)[number] }),
        tabs,
      });

    const screen = render(renderPager("albums"));
    screen.rerender(renderPager("events"));

    expect(mounts).toEqual({ albums: 1, events: 1 });
  });

  it("passes active and preview flags to rendered pages", () => {
    const renderPage = jest.fn((tab: unknown, preview: boolean, active: boolean) =>
      React.createElement(Text, null, `${String(tab)}:${preview}:${active}`),
    );

    render(
      React.createElement(SwipeableTabPager, {
        activeTab: "albums",
        keepAlive: true,
        onChange: jest.fn(),
        renderPage,
        tabs: ["albums", "events"] as const,
      }),
    );

    expect(renderPage.mock.calls[0]?.[1]).toBe(false);
    expect(renderPage.mock.calls[0]?.[2]).toBe(true);
  });

  it("settles fill-layout swipes and reports progress without remounting pages", () => {
    const onChange = jest.fn();
    const onPageProgressChange = jest.fn();
    const onPreviewTabChange = jest.fn();
    const renderPage = jest.fn((tab: unknown) => React.createElement(Text, null, String(tab)));
    const screen = render(
      React.createElement(SwipeableTabPager, {
        activeTab: "albums",
        onChange,
        onPageProgressChange,
        onPreviewTabChange,
        renderPage,
        tabs: ["albums", "events"] as const,
      }),
    );
    const pager = screen.UNSAFE_getByType(FlatList);
    const width = pager.props.getItemLayout(null, 1).length;

    expect(pager.props.keyExtractor("albums")).toBe("albums");
    expect(pager.props.getItemLayout(null, 1)).toEqual({ index: 1, length: width, offset: width });
    act(() => pager.props.onScrollBeginDrag());
    act(() => pager.props.onScroll({ nativeEvent: { contentOffset: { x: width * 0.4, y: 0 } } }));
    expect(onPageProgressChange).toHaveBeenLastCalledWith(0.4);
    expect(onPreviewTabChange).toHaveBeenLastCalledWith("events");

    act(() =>
      pager.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: width, y: 0 } },
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith("events");
    act(() => pager.props.onScrollToIndexFailed({ index: 1 }));
  });

  it("keeps programmatic fill-layout selection from emitting a duplicate change", () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    const createPager = (activeTab: "albums" | "events") =>
      React.createElement(SwipeableTabPager, {
        activeTab,
        onChange,
        renderPage: (tab: unknown) => React.createElement(Text, null, String(tab)),
        tabs: ["albums", "events"] as const,
      });
    const screen = render(createPager("albums"));

    screen.rerender(createPager("events"));
    const pager = screen.UNSAFE_getByType(FlatList);
    const width = pager.props.getItemLayout(null, 1).length;
    act(() =>
      pager.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: width, y: 0 } },
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it("uses a measured fallback pager for content layout", () => {
    const onChange = jest.fn();
    const onPageProgressChange = jest.fn();
    const screen = render(
      React.createElement(SwipeableTabPager, {
        activeTab: "albums",
        keepAlive: false,
        layoutMode: "content",
        lazy: true,
        onChange,
        onPageProgressChange,
        renderPage: (tab: unknown) => React.createElement(Text, null, String(tab)),
        tabs: TABS,
      }),
    );
    const pager = screen.UNSAFE_getByType(FlatList);
    const width = pager.props.getItemLayout(null, 1).length;
    const measuredPage = screen
      .UNSAFE_getAllByType(View)
      .find((view) => typeof view.props.onLayout === "function");

    act(() => measuredPage?.props.onLayout({ nativeEvent: { layout: { height: 0 } } }));
    act(() => measuredPage?.props.onLayout({ nativeEvent: { layout: { height: 180 } } }));
    act(() => measuredPage?.props.onLayout({ nativeEvent: { layout: { height: 180.4 } } }));
    act(() => measuredPage?.props.onLayout({ nativeEvent: { layout: { height: 220 } } }));
    expect(pager.props.keyExtractor("events")).toBe("events");
    act(() =>
      pager.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: 0, y: 0 } },
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
    act(() => pager.props.onScrollBeginDrag());
    act(() => pager.props.onScroll({ nativeEvent: { contentOffset: { x: width * 0.5, y: 0 } } }));
    expect(onPageProgressChange).toHaveBeenLastCalledWith(0.5);
    act(() =>
      pager.props.onMomentumScrollEnd({
        nativeEvent: { contentOffset: { x: width, y: 0 } },
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith("events");
    act(() => pager.props.onScrollToIndexFailed({ index: 2 }));
  });

  it("uses native content paging and handles programmatic and gesture selections", () => {
    jest.useFakeTimers();
    const setPage = jest.fn();
    const setPageWithoutAnimation = jest.fn();
    const NativePager = React.forwardRef((props: any, ref: React.ForwardedRef<unknown>) => {
      React.useImperativeHandle(ref, () => ({ setPage, setPageWithoutAnimation }));
      return React.createElement(View, { ...props, testID: "native-pager" }, props.children);
    });
    NativePager.displayName = "NativePager";
    mockedLoadNativePagerView.mockReturnValue(NativePager as any);
    const onChange = jest.fn();
    const onPageProgressChange = jest.fn();
    const onPreviewTabChange = jest.fn();
    const createPager = (activeTab: "albums" | "events") =>
      React.createElement(SwipeableTabPager, {
        activeTab,
        layoutMode: "content" as const,
        onChange,
        onPageProgressChange,
        onPreviewTabChange,
        renderPage: (tab: unknown) => React.createElement(Text, null, String(tab)),
        tabs: ["albums", "events"] as const,
      });
    const screen = render(createPager("albums"));
    let pager = screen.getByTestId("native-pager");

    act(() => pager.props.onPageScroll({ nativeEvent: { position: 0, offset: 0.2 } }));
    act(() => pager.props.onPageSelected({ nativeEvent: { position: 1 } }));
    expect(onChange).not.toHaveBeenCalled();
    act(() => jest.runOnlyPendingTimers());
    expect(setPageWithoutAnimation).toHaveBeenCalledWith(0);
    act(() => pager.props.onPageScrollStateChanged({ nativeEvent: { pageScrollState: "idle" } }));
    act(() =>
      pager.props.onPageScrollStateChanged({ nativeEvent: { pageScrollState: "dragging" } }),
    );
    act(() => pager.props.onPageScroll({ nativeEvent: { position: 1, offset: 0 } }));
    expect(onPageProgressChange).toHaveBeenLastCalledWith(1);
    expect(onPreviewTabChange).toHaveBeenLastCalledWith("events");
    act(() => pager.props.onPageSelected({ nativeEvent: { position: 1 } }));
    expect(onChange).toHaveBeenLastCalledWith("events");

    screen.rerender(createPager("events"));
    act(() => jest.runOnlyPendingTimers());
    expect(setPage).toHaveBeenLastCalledWith(1);
    pager = screen.getByTestId("native-pager");
    const measuredPage = screen
      .UNSAFE_getAllByType(View)
      .find((view) => view !== pager && typeof view.props.onLayout === "function");
    act(() => measuredPage?.props.onLayout({ nativeEvent: { layout: { height: 160 } } }));
  });
});
