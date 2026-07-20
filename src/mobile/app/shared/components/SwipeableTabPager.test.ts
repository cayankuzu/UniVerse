import React, { useEffect } from "react";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  clampPageProgress,
  resolvePagedScrollIndex,
  shouldRenderPagedItem,
  SwipeableTabPager,
} from "./SwipeableTabPager";

const TABS = ["albums", "events", "clubs", "students"] as const;

describe("SwipeableTabPager", () => {
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
    expect(shouldRenderPagedItem(2, 0, false, true)).toBe(true);
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
});
