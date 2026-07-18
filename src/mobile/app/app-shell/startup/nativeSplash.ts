import * as ExpoSplashScreen from "expo-splash-screen";

// Keep the native splash visible until the first real app frame is ready.
ExpoSplashScreen.setOptions({
  duration: 180,
  fade: true,
});
void ExpoSplashScreen.preventAutoHideAsync().catch(() => false);

export async function hideNativeSplashScreen() {
  await ExpoSplashScreen.hideAsync().catch(() => undefined);
}
