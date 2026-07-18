import { useEffect } from "react";
import { AppState } from "react-native";
import { degradeRuntimePerformanceTier } from "../../shared/performance/runtimePerformanceTier";

export function AppRuntimePerformanceBridge() {
  useEffect(() => {
    const subscription = AppState.addEventListener("memoryWarning", () => {
      degradeRuntimePerformanceTier("tier3");
      void (require("expo-image").Image.clearMemoryCache() as Promise<boolean>).catch(
        () => undefined,
      );
    });
    return () => subscription.remove();
  }, []);

  return null;
}
