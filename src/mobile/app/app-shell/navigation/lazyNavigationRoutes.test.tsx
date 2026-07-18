import React from "react";
import { render } from "@testing-library/react-native";

const mockResolvedRoute = jest.fn(() => null);

jest.mock("@react-navigation/native-stack", () => {
  const ReactRuntime = require("react") as typeof React;
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children?: React.ReactNode }) =>
        ReactRuntime.createElement(ReactRuntime.Fragment, null, children),
      Screen: ({ getComponent }: { getComponent?: () => React.ComponentType }) => {
        getComponent?.();
        return null;
      },
    }),
  };
});

jest.mock("./navigators/AuthNavigator", () => ({ AuthNavigator: mockResolvedRoute }));
jest.mock("./navigators/MainTabsNavigator", () => ({ MainTabsNavigator: mockResolvedRoute }));
jest.mock("../../features/auth/public/screens", () => ({
  AuthCallbackScreen: mockResolvedRoute,
  ClubRegisterScreen: mockResolvedRoute,
  ForgotPasswordScreen: mockResolvedRoute,
  LoginScreen: mockResolvedRoute,
  RegisterScreen: mockResolvedRoute,
  ResetPasswordScreen: mockResolvedRoute,
  StudentRegisterScreen: mockResolvedRoute,
  VerifyEmailScreen: mockResolvedRoute,
  WelcomeScreen: mockResolvedRoute,
}));
jest.mock("../../features/events/public/screens", () => ({
  AlbumViewScreen: mockResolvedRoute,
  CreateEventScreen: mockResolvedRoute,
  EventDetailScreen: mockResolvedRoute,
}));
jest.mock("../../features/notifications/public/screens", () => ({
  NotificationsScreen: mockResolvedRoute,
}));
jest.mock("../../features/profile/public/screens", () => ({
  EditProfileScreen: mockResolvedRoute,
  UserListScreen: mockResolvedRoute,
  ViewProfileScreen: mockResolvedRoute,
}));
jest.mock("../../features/settings/public/screens", () => ({
  BlockedUsersScreen: mockResolvedRoute,
  ChangePasswordScreen: mockResolvedRoute,
  PermissionsSettingsScreen: mockResolvedRoute,
  PrivacySettingsScreen: mockResolvedRoute,
  SettingsScreen: mockResolvedRoute,
}));
jest.mock("./navigators/stacks/HomeStackNavigator", () => ({
  HomeStackNavigator: mockResolvedRoute,
}));
jest.mock("./navigators/stacks/SearchStackNavigator", () => ({
  SearchStackNavigator: mockResolvedRoute,
}));
jest.mock("./navigators/stacks/ProfileStackNavigator", () => ({
  ProfileStackNavigator: mockResolvedRoute,
}));

describe("lazy navigation route factories", () => {
  it("resolves every root route only when its screen registration asks for it", () => {
    const { RootNavigatorScreens } =
      require("./rootNavigationScreens") as typeof import("./rootNavigationScreens");

    const authTree = render(<RootNavigatorScreens showAuthenticatedShell={false} />);
    authTree.unmount();
    render(<RootNavigatorScreens showAuthenticatedShell />);

    expect(mockResolvedRoute).not.toHaveBeenCalled();
  });

  it("resolves auth and secondary tab modules through getComponent", () => {
    jest.unmock("./navigators/AuthNavigator");
    jest.unmock("./navigators/MainTabsNavigator");
    jest.resetModules();

    const { AuthNavigator } =
      require("./navigators/AuthNavigator") as typeof import("./navigators/AuthNavigator");
    const { MainTabsNavigator } =
      require("./navigators/MainTabsNavigator") as typeof import("./navigators/MainTabsNavigator");

    render(<AuthNavigator />);
    render(<MainTabsNavigator />);

    expect(mockResolvedRoute).not.toHaveBeenCalled();
  });
});
