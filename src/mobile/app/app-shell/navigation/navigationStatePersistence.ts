import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NavigationState, PartialState } from "@react-navigation/native";

const NAVIGATION_STATE_STORAGE_KEY = "navigation-state:v1";

export async function restorePersistedNavigationState() {
  return undefined;
}

export async function persistNavigationState(
  _state: NavigationState | PartialState<NavigationState> | undefined,
) {
  return undefined;
}

export async function clearPersistedNavigationState() {
  await AsyncStorage.removeItem(NAVIGATION_STATE_STORAGE_KEY).catch(() => undefined);
}
