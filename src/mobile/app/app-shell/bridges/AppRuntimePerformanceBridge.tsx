import { useEffect } from "react";
import { AppState } from "react-native";
import { addLowPowerModeListener, isLowPowerModeEnabledAsync } from "expo-battery";
import { degradeRuntimePerformanceTier } from "../../shared/performance/runtimePerformanceTier";
import { setLowPowerModeEnabled } from "../../shared/performance/resourceConstraints";
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

  useEffect(() => {
    let mounted = true;
    void isLowPowerModeEnabledAsync()
      .then((enabled) => {
        if (mounted) setLowPowerModeEnabled(enabled);
      })
      .catch(() => undefined);
    const subscription = addLowPowerModeListener(({ lowPowerMode }) => {
      setLowPowerModeEnabled(lowPowerMode);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return null;
}
