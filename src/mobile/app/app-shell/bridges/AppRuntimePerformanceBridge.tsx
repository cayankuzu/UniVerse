import { useEffect } from "react";
import { AppState } from "react-native";
import { degradeRuntimePerformanceTier } from "../../shared/performance/runtimePerformanceTier";
import { clearVideoThumbnailMemoryCache } from "../../shared/media/videoThumbnailCache";

export function AppRuntimePerformanceBridge() {
  useEffect(() => {
    const subscription = AppState.addEventListener("memoryWarning", () => {
      degradeRuntimePerformanceTier("tier3");
      clearVideoThumbnailMemoryCache();
      void (require("expo-image").Image.clearMemoryCache() as Promise<boolean>).catch(
        () => undefined,
      );
    });
    return () => subscription.remove();
  }, []);

  return null;
}
