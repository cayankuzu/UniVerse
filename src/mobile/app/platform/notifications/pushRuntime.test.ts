jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    appOwnership: null,
    easConfig: {},
    executionEnvironment: "bare",
    expoConfig: { extra: {} },
  },
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}));

import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolvePushRuntimeSupport } from "./pushRuntime";

type MutableConstants = {
  appOwnership?: unknown;
  easConfig?: { projectId?: unknown };
  executionEnvironment?: unknown;
  expoConfig?: { extra?: { eas?: { projectId?: unknown } } };
};

describe("resolvePushRuntimeSupport", () => {
  const mutableConstants = Constants as unknown as MutableConstants;
  const mutablePlatform = Platform as { OS: string };

  beforeEach(() => {
    mutableConstants.appOwnership = null;
    mutableConstants.executionEnvironment = "bare";
    mutablePlatform.OS = "android";
  });

  it("allows push registration in bare dev-client style runtimes", () => {
    expect(resolvePushRuntimeSupport()).toEqual({
      enabled: true,
      reason: "supported-runtime",
    });
  });

  it("keeps Expo Go style runtimes disabled", () => {
    mutableConstants.appOwnership = "expo";
    mutableConstants.executionEnvironment = "storeclient";

    expect(resolvePushRuntimeSupport()).toEqual({
      enabled: false,
      reason: "expo-go-runtime",
    });
  });
});
