import type { NavigationState, PartialState } from "@react-navigation/native";

export type RouteNavigator = {
  getParent?: () => RouteNavigator | undefined;
  getState?: () => NavigationState | PartialState<NavigationState> | undefined;
  navigate: unknown;
  preload?: unknown;
  push?: unknown;
};

type NavigateOptions = {
  method?: "navigate" | "push";
};

type RouteInvoker = (name: string, params?: object) => unknown;

function isRouteInvoker(value: unknown): value is RouteInvoker {
  return typeof value === "function";
}

function getRouteNames(navigation: RouteNavigator): string[] {
  const state = navigation.getState?.() as
    NavigationState | PartialState<NavigationState> | undefined;
  if (!Array.isArray(state?.routeNames)) return [];
  return state.routeNames.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

export function findNavigatorForRoute(
  navigation: RouteNavigator,
  routeName: string,
): RouteNavigator | null {
  const visited = new Set<RouteNavigator>();
  let current: RouteNavigator | null = navigation;

  while (current && !visited.has(current)) {
    visited.add(current);
    if (getRouteNames(current).includes(routeName)) {
      return current;
    }
    current =
      typeof current.getParent === "function"
        ? ((current.getParent() as RouteNavigator | undefined) ?? null)
        : null;
  }

  return null;
}

export function navigateToRegisteredRoute(
  navigation: RouteNavigator,
  routeName: string,
  params?: object,
  options?: NavigateOptions,
) {
  const targetNavigator = findNavigatorForRoute(navigation, routeName) ?? navigation;
  if (options?.method === "push" && isRouteInvoker(targetNavigator.push)) {
    targetNavigator.push(routeName, params);
    return;
  }
  if (isRouteInvoker(targetNavigator.navigate)) {
    targetNavigator.navigate(routeName, params);
  }
}

export function preloadRegisteredRoute(
  navigation: RouteNavigator,
  routeName: string,
  params?: object,
): boolean {
  const targetNavigator = findNavigatorForRoute(navigation, routeName);
  if (!targetNavigator || !isRouteInvoker(targetNavigator.preload)) {
    return false;
  }

  try {
    targetNavigator.preload(routeName, params);
    return true;
  } catch {
    return false;
  }
}
