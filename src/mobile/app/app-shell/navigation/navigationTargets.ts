import type { NavigationState, PartialState } from "@react-navigation/native";
import type {
  AuthRouteName,
  RootLeafRouteName,
  RootNavigatorParamList,
  RootStackParamList,
} from "./types";

type AnyRouteParams = RootStackParamList[RootLeafRouteName];
type DirectRootRouteName = Exclude<
  RootLeafRouteName,
  AuthRouteName | "Home" | "Profile" | "Search"
>;

type NavigateTarget = {
  name: keyof RootNavigatorParamList;
  params?: RootNavigatorParamList[keyof RootNavigatorParamList];
};

type ResetRouteTarget = {
  name: string;
  params?: AnyRouteParams;
  state?: PartialState<NavigationState> | undefined;
};

type RootNavigation = {
  navigate: unknown;
};

type RootNavigateInvoker = (
  name: keyof RootNavigatorParamList,
  params?: RootNavigatorParamList[keyof RootNavigatorParamList],
) => unknown;

function isRootNavigateInvoker(value: unknown): value is RootNavigateInvoker {
  return typeof value === "function";
}

function withLeafParams(name: RootLeafRouteName, params?: AnyRouteParams) {
  return params === undefined ? { name } : { name, params };
}

function buildAuthNavigateTarget(
  routeName: AuthRouteName,
  params?: AnyRouteParams,
): NavigateTarget {
  return params === undefined
    ? {
        name: "AuthNavigator",
        params: { screen: routeName } as RootNavigatorParamList["AuthNavigator"],
      }
    : {
        name: "AuthNavigator",
        params: {
          params,
          screen: routeName,
        } as RootNavigatorParamList["AuthNavigator"],
      };
}

function buildAuthResetTarget(routeName: AuthRouteName, params?: AnyRouteParams): ResetRouteTarget {
  return {
    name: "AuthNavigator",
    state: {
      index: 0,
      routes: [withLeafParams(routeName, params)],
    },
  };
}

function buildTabNavigateTarget(routeName: "Home" | "Profile" | "Search"): NavigateTarget {
  const tabName =
    routeName === "Home" ? "HomeTab" : routeName === "Search" ? "SearchTab" : "ProfileTab";
  return {
    name: "MainTabsNavigator",
    params: {
      params: {
        screen: routeName,
      },
      screen: tabName,
    } as RootNavigatorParamList["MainTabsNavigator"],
  };
}

function buildTabResetTarget(routeName: "Home" | "Profile" | "Search"): ResetRouteTarget {
  const tabName =
    routeName === "Home" ? "HomeTab" : routeName === "Search" ? "SearchTab" : "ProfileTab";
  return {
    name: "MainTabsNavigator",
    state: {
      index: 0,
      routes: [
        {
          name: tabName,
          state: {
            index: 0,
            routes: [{ name: routeName }],
          },
        },
      ],
    },
  };
}

export function buildNavigateTarget(
  routeName: RootLeafRouteName,
  params?: AnyRouteParams,
): NavigateTarget {
  switch (routeName) {
    case "Welcome":
    case "Login":
    case "Register":
    case "StudentRegister":
    case "ClubRegister":
    case "VerifyEmail":
    case "ForgotPassword":
      return buildAuthNavigateTarget(routeName, params);
    case "ResetPassword":
    case "AuthCallback":
      return params === undefined
        ? { name: routeName }
        : {
            name: routeName,
            params: params as RootNavigatorParamList[keyof RootNavigatorParamList],
          };
    case "Home":
    case "Search":
    case "Profile":
      return buildTabNavigateTarget(routeName);
    default:
      return params === undefined
        ? { name: routeName as DirectRootRouteName }
        : {
            name: routeName as DirectRootRouteName,
            params: params as RootNavigatorParamList[keyof RootNavigatorParamList],
          };
  }
}

function buildResetRouteTarget(
  routeName: RootLeafRouteName,
  params?: AnyRouteParams,
): ResetRouteTarget {
  switch (routeName) {
    case "Welcome":
    case "Login":
    case "Register":
    case "StudentRegister":
    case "ClubRegister":
    case "VerifyEmail":
    case "ForgotPassword":
      return buildAuthResetTarget(routeName, params);
    case "ResetPassword":
    case "AuthCallback":
      return withLeafParams(routeName, params);
    case "Home":
    case "Search":
    case "Profile":
      return buildTabResetTarget(routeName);
    default:
      return withLeafParams(routeName as DirectRootRouteName, params);
  }
}

export function buildResetStateForRoute(
  routeName: RootLeafRouteName,
  params?: AnyRouteParams,
): PartialState<NavigationState> {
  return {
    index: 0,
    routes: [buildResetRouteTarget(routeName, params)],
  } as PartialState<NavigationState>;
}

export function navigateToRoute<RouteName extends RootLeafRouteName>(
  navigation: Pick<RootNavigation, "navigate">,
  routeName: RouteName,
  params?: RootStackParamList[RouteName],
) {
  const target = buildNavigateTarget(routeName, params);
  if (isRootNavigateInvoker(navigation.navigate)) {
    navigation.navigate(target.name, target.params);
  }
}

export function resolveActiveRouteName(
  state?: NavigationState | PartialState<NavigationState>,
): string {
  if (!state || !state.routes?.length) return "";
  const index = typeof state.index === "number" ? state.index : state.routes.length - 1;
  const activeRoute = state.routes[index] as
    | {
        name?: string;
        state?: NavigationState | PartialState<NavigationState>;
      }
    | undefined;
  if (!activeRoute) return "";
  const nestedRouteName = resolveActiveRouteName(activeRoute.state);
  return nestedRouteName || String(activeRoute.name || "");
}
