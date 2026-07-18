import AsyncStorage from "@react-native-async-storage/async-storage";

export const ALBUM_LOCAL_SHADOW_STORAGE_KEY = "album-local-shadow:v2";
export const EVENT_LOCAL_SHADOW_STORAGE_KEY = "event-local-shadow:v2";

let clearAlbumShadowMemoryCache = () => {};
let clearEventShadowMemoryCache = () => {};

export function registerAlbumLocalShadowReset(handler: () => void) {
  clearAlbumShadowMemoryCache = handler;
}

export function registerEventLocalShadowReset(handler: () => void) {
  clearEventShadowMemoryCache = handler;
}

export async function clearLocalAlbumShadowStorage() {
  clearAlbumShadowMemoryCache();
  await AsyncStorage.removeItem(ALBUM_LOCAL_SHADOW_STORAGE_KEY);
}

export async function clearLocalEventShadowStorage() {
  clearEventShadowMemoryCache();
  await AsyncStorage.removeItem(EVENT_LOCAL_SHADOW_STORAGE_KEY);
}
