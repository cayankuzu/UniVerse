import * as Haptics from "expo-haptics";
import { triggerHapticFeedback } from "./haptics";

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe("triggerHapticFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes each semantic feedback type to the native haptics API", () => {
    triggerHapticFeedback("selection");
    triggerHapticFeedback("success");
    triggerHapticFeedback("light");

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  });

  it("absorbs unsupported-device rejections", () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error("unsupported"));

    expect(() => triggerHapticFeedback("selection")).not.toThrow();
  });
});
