import {
  findNavigatorForRoute,
  navigateToRegisteredRoute,
  preloadRegisteredRoute,
  type RouteNavigator,
} from "./routeNavigator";

type MockNavigator = RouteNavigator & {
  getParent: jest.Mock;
  getState: jest.Mock;
  navigate: jest.MockedFunction<(name: string, params?: object) => unknown>;
  preload?: jest.Mock;
  push?: jest.Mock;
};

function createNavigator(params: {
  parent?: MockNavigator | null;
  routeNames: string[];
  withPreload?: boolean;
  withPush?: boolean;
}): MockNavigator {
  return {
    getParent: jest.fn(() => params.parent ?? undefined),
    getState: jest.fn(() => ({ index: 0, routeNames: params.routeNames, routes: [] })),
    navigate: jest.fn(),
    preload: params.withPreload ? jest.fn() : undefined,
    push: params.withPush ? jest.fn() : undefined,
  };
}

describe("app-shell routeNavigator", () => {
  it("finds the nearest navigator that owns the requested route", () => {
    const root = createNavigator({ routeNames: ["MainTabsNavigator", "ViewProfile"] });
    const child = createNavigator({ parent: root, routeNames: ["Home"] });

    expect(findNavigatorForRoute(child, "ViewProfile")).toBe(root);
    expect(findNavigatorForRoute(child, "Home")).toBe(child);
  });

  it("preloads on the owning parent navigator instead of the current child stack", () => {
    const root = createNavigator({
      routeNames: ["MainTabsNavigator", "ViewProfile"],
      withPreload: true,
    });
    const child = createNavigator({
      parent: root,
      routeNames: ["Home"],
      withPreload: true,
    });

    expect(preloadRegisteredRoute(child, "ViewProfile", { username: "cyn" })).toBe(true);
    expect(root.preload).toHaveBeenCalledWith("ViewProfile", { username: "cyn" });
    expect(child.preload).not.toHaveBeenCalled();
  });

  it("navigates with push on the owning navigator when available", () => {
    const root = createNavigator({
      routeNames: ["ViewProfile"],
      withPush: true,
    });
    const child = createNavigator({ parent: root, routeNames: ["Home"] });

    navigateToRegisteredRoute(child, "ViewProfile", { username: "cyn" }, { method: "push" });

    expect(root.push).toHaveBeenCalledWith("ViewProfile", { username: "cyn" });
    expect(root.navigate).not.toHaveBeenCalled();
    expect(child.navigate).not.toHaveBeenCalled();
  });

  it("falls back to navigate when push is unavailable", () => {
    const root = createNavigator({
      routeNames: ["EventDetail"],
    });
    const child = createNavigator({ parent: root, routeNames: ["Home"] });

    navigateToRegisteredRoute(child, "EventDetail", { eventId: "event-1" }, { method: "push" });

    expect(root.navigate).toHaveBeenCalledWith("EventDetail", { eventId: "event-1" });
  });
});
