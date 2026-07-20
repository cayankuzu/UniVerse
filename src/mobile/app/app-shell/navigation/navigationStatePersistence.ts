import AsyncStorage from "@react-native-async-storage/async-storage";

const NAVIGATION_STATE_STORAGE_KEY = "navigation-state:v1";

export async function clearPersistedNavigationState() {
  await AsyncStorage.removeItem(NAVIGATION_STATE_STORAGE_KEY).catch(() => undefined);
}
