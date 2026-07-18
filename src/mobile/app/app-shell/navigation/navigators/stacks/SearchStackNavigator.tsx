import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SearchScreen } from "../../../../features/search/public/screens";
import type { SearchStackParamList } from "../../types";

const SearchStack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStackNavigator() {
  return (
    <SearchStack.Navigator
      initialRouteName="Search"
      screenOptions={{
        animation: "none",
        freezeOnBlur: false,
        gestureEnabled: false,
        headerShown: false,
      }}
    >
      <SearchStack.Screen name="Search" component={SearchScreen} />
    </SearchStack.Navigator>
  );
}
