import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootNavigatorParamList } from "./types";

const getAuthNavigator = () => require("./navigators/AuthNavigator").AuthNavigator;
const getMainTabsNavigator = () => require("./navigators/MainTabsNavigator").MainTabsNavigator;
const getAuthCallbackScreen = () =>
  require("../../features/auth/public/screens").AuthCallbackScreen;
const getResetPasswordScreen = () =>
  require("../../features/auth/public/screens").ResetPasswordScreen;
const getAlbumViewScreen = () => require("../../features/events/public/screens").AlbumViewScreen;
const getCreateEventScreen = () =>
  require("../../features/events/public/screens").CreateEventScreen;
const getEventDetailScreen = () =>
  require("../../features/events/public/screens").EventDetailScreen;
const getNotificationsScreen = () =>
  require("../../features/notifications/public/screens").NotificationsScreen;
const getEditProfileScreen = () =>
  require("../../features/profile/public/screens").EditProfileScreen;
const getUserListScreen = () => require("../../features/profile/public/screens").UserListScreen;
const getViewProfileScreen = () =>
  require("../../features/profile/public/screens").ViewProfileScreen;
const getBlockedUsersScreen = () =>
  require("../../features/settings/public/screens").BlockedUsersScreen;
const getChangePasswordScreen = () =>
  require("../../features/settings/public/screens").ChangePasswordScreen;
const getPermissionsSettingsScreen = () =>
  require("../../features/settings/public/screens").PermissionsSettingsScreen;
const getPrivacySettingsScreen = () =>
  require("../../features/settings/public/screens").PrivacySettingsScreen;
const getSettingsScreen = () => require("../../features/settings/public/screens").SettingsScreen;

export const RootStack = createNativeStackNavigator<RootNavigatorParamList>();

type RootNavigatorScreensProps = {
  showAuthenticatedShell: boolean;
};

export function RootNavigatorScreens({ showAuthenticatedShell }: RootNavigatorScreensProps) {
  return (
    <RootStack.Navigator
      screenOptions={{
        animation: "fade_from_bottom",
        freezeOnBlur: true,
        gestureEnabled: true,
        headerShown: false,
      }}
    >
      {showAuthenticatedShell ? (
        <RootStack.Screen
          name="MainTabsNavigator"
          getComponent={getMainTabsNavigator}
          options={{ animation: "none", gestureEnabled: false }}
        />
      ) : (
        <RootStack.Screen
          name="AuthNavigator"
          getComponent={getAuthNavigator}
          options={{ animation: "none", gestureEnabled: false }}
        />
      )}

      {showAuthenticatedShell ? (
        <RootStack.Screen name="CreateEvent" getComponent={getCreateEventScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="Settings" getComponent={getSettingsScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="Permissions" getComponent={getPermissionsSettingsScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="PrivacySettings" getComponent={getPrivacySettingsScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="EditProfile" getComponent={getEditProfileScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="UserList" getComponent={getUserListScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="ViewProfile" getComponent={getViewProfileScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="AlbumView" getComponent={getAlbumViewScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="EventDetail" getComponent={getEventDetailScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="Notifications" getComponent={getNotificationsScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="ChangePassword" getComponent={getChangePasswordScreen} />
      ) : null}
      {showAuthenticatedShell ? (
        <RootStack.Screen name="BlockedUsers" getComponent={getBlockedUsersScreen} />
      ) : null}

      <RootStack.Screen name="AuthCallback" getComponent={getAuthCallbackScreen} />
      <RootStack.Screen name="ResetPassword" getComponent={getResetPasswordScreen} />
    </RootStack.Navigator>
  );
}
