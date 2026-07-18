import { renderHook } from "@testing-library/react-native";
import { useAppStartupState } from "./AppStartupState";

describe("useAppStartupState", () => {
  it("fails fast when the startup state provider is missing", () => {
    expect(() => renderHook(() => useAppStartupState())).toThrow(
      "useAppStartupState must be used within an AppStartupStateProvider",
    );
  });
});
