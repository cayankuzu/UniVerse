import Constants from "expo-constants";
import { Platform } from "react-native";

const PLACEHOLDER_EAS_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

function normalizeRuntimeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function resolvePushPlatform() {
  return Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : null;
}

export function resolveExpoProjectId() {
  const extra = (Constants.expoConfig?.extra || {}) as {
    eas?: { projectId?: unknown };
  };
  const rawProjectId = String(
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
      Constants.easConfig?.projectId ||
      extra.eas?.projectId ||
      "",
  ).trim();
  if (!rawProjectId || rawProjectId === PLACEHOLDER_EAS_PROJECT_ID) {
    return "";
  }
  return rawProjectId;
}

export function resolvePushRuntimeSupport() {
  const appOwnership = normalizeRuntimeText((Constants as { appOwnership?: unknown }).appOwnership);
  const executionEnvironment = normalizeRuntimeText(
    (Constants as { executionEnvironment?: unknown }).executionEnvironment,
  );
  const isExpoGoRuntime =
    appOwnership === "expo" || appOwnership === "guest" || executionEnvironment === "storeclient";

  if (!resolvePushPlatform()) {
    return {
      enabled: false,
      reason: "unsupported-platform",
    } as const;
  }

  if (isExpoGoRuntime) {
    return {
      enabled: false,
      reason: "expo-go-runtime",
    } as const;
  }

  return {
    enabled: true,
    reason: "supported-runtime",
  } as const;
}
