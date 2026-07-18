import { act, renderHook } from "@testing-library/react-native";
import { useAuthBootTimeout } from "./useAuthBootTimeout";

describe("useAuthBootTimeout", () => {
  it("releases a stalled auth bootstrap after the bounded deadline", () => {
    jest.useFakeTimers();
    const clearAuthState = jest.fn();
    renderHook(() =>
      useAuthBootTimeout({
        isLoading: true,
        clearAuthState,
      }),
    );

    act(() => jest.runOnlyPendingTimers());
    expect(clearAuthState).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
