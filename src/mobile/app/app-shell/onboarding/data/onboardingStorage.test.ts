import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parsePermissionSnapshot,
  persistPermissionPromptPreference,
  persistPermissionSnapshot,
  readPermissionPromptPreference,
  readPermissionSnapshot,
} from "./onboardingStorage";

describe("onboardingStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("stores prompt suppression per user", async () => {
    await persistPermissionPromptPreference({
      suppressPrompt: true,
      userId: "user-a",
    });

    expect(await readPermissionPromptPreference("user-a")).toBe(true);
    expect(await readPermissionPromptPreference("user-b")).toBe(false);

    await persistPermissionPromptPreference({
      suppressPrompt: false,
      userId: "user-a",
    });

    expect(await readPermissionPromptPreference("user-a")).toBe(false);
  });

  it("round-trips the permission snapshot shape", async () => {
    await persistPermissionSnapshot({
      camera: "granted",
      completedAt: "2026-03-30T10:00:00.000Z",
      location: "granted",
      microphone: "denied",
      notifications: "denied",
      photos: "undetermined",
    });

    expect(await readPermissionSnapshot()).toEqual(
      parsePermissionSnapshot(
        '{"camera":"granted","completedAt":"2026-03-30T10:00:00.000Z","location":"granted","microphone":"denied","notifications":"denied","photos":"undetermined"}',
      ),
    );
  });
});
