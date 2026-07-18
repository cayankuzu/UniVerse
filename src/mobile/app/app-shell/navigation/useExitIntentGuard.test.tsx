import { BackHandler } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { EXIT_INTENT_MESSAGE, useExitIntentGuard } from "./useExitIntentGuard";

describe("useExitIntentGuard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(BackHandler, "exitApp").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("requires a second back press within the exit window", () => {
    const { result } = renderHook(() => useExitIntentGuard());

    act(() => {
      result.current.confirmExit();
    });

    expect(result.current.exitMessage).toBe(EXIT_INTENT_MESSAGE);
    expect(BackHandler.exitApp).not.toHaveBeenCalled();

    act(() => {
      result.current.confirmExit();
    });

    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
  });

  it("clears the exit hint after the timeout", () => {
    const { result } = renderHook(() => useExitIntentGuard());

    act(() => {
      result.current.confirmExit();
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.exitMessage).toBeNull();
  });
});
