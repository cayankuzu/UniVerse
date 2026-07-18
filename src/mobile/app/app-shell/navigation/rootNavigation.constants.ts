import type { RootNavigatorParamList } from "./types";

export type RootNavigatorMode = "app" | "auth";
export type RootTabName = "create" | "home" | "profile" | "search";
export const ROOT_LEAF_ROUTE_NAMES = [
  "Welcome",
  "Login",
  "Register",
  "StudentRegister",
  "ClubRegister",
  "VerifyEmail",
  "ForgotPassword",
  "Home",
  "Search",
  "Profile",
  "CreateEvent",
  "Settings",
  "Permissions",
  "PrivacySettings",
  "EditProfile",
  "UserList",
  "ViewProfile",
  "AlbumView",
  "EventDetail",
  "Notifications",
  "ChangePassword",
  "BlockedUsers",
] as const;

export const AUTH_ROUTE_NAMES = new Set<string>([
  "AuthNavigator",
  "Welcome",
  "Login",
  "Register",
  "StudentRegister",
  "ClubRegister",
  "VerifyEmail",
  "ForgotPassword",
]);

export const APP_ROUTE_NAMES = new Set<string>([
  "MainTabsNavigator",
  "HomeTab",
  "SearchTab",
  "ProfileTab",
  "Home",
  "Search",
  "Profile",
  "CreateEvent",
  "Settings",
  "Permissions",
  "PrivacySettings",
  "EditProfile",
  "UserList",
  "ViewProfile",
  "AlbumView",
  "EventDetail",
  "Notifications",
  "ChangePassword",
  "BlockedUsers",
]);

export function resolveRootNavigatorMode(params: { isLoggedIn: boolean }): RootNavigatorMode {
  return params.isLoggedIn ? "app" : "auth";
}

export function resolveRootNavigatorInitialRoute(
  mode: RootNavigatorMode,
): keyof RootNavigatorParamList {
  return mode === "app" ? "MainTabsNavigator" : "AuthNavigator";
}

export function resolveRootTab(routeName: string): RootTabName {
  if (routeName === "Search" || routeName === "SearchTab") return "search";
  if (routeName === "CreateEvent") return "create";
  if (routeName === "Profile" || routeName === "ProfileTab") return "profile";
  return "home";
}

export function shouldShowRootTabs(params: {
  currentRoute: string;
  isLoading: boolean;
  isLoggedIn: boolean;
}) {
  return (
    params.isLoggedIn &&
    !params.isLoading &&
    (params.currentRoute === "Home" ||
      params.currentRoute === "Search" ||
      params.currentRoute === "Profile" ||
      params.currentRoute === "HomeTab" ||
      params.currentRoute === "SearchTab" ||
      params.currentRoute === "ProfileTab" ||
      params.currentRoute === "MainTabsNavigator")
  );
}
