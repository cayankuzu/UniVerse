import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { MainTabsParamList } from "../types";
import { HomeStackNavigator } from "./stacks/HomeStackNavigator";

const getSearchStackNavigator = () => require("./stacks/SearchStackNavigator").SearchStackNavigator;
const getProfileStackNavigator = () =>
  require("./stacks/ProfileStackNavigator").ProfileStackNavigator;

const MainTabsStack = createNativeStackNavigator<MainTabsParamList>();

export function MainTabsNavigator() {
  return (
    <MainTabsStack.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        animation: "none",
        freezeOnBlur: false,
        gestureEnabled: false,
        headerShown: false,
      }}
    >
      <MainTabsStack.Screen name="HomeTab" component={HomeStackNavigator} />
      <MainTabsStack.Screen name="SearchTab" getComponent={getSearchStackNavigator} />
      <MainTabsStack.Screen name="ProfileTab" getComponent={getProfileStackNavigator} />
    </MainTabsStack.Navigator>
  );
}
