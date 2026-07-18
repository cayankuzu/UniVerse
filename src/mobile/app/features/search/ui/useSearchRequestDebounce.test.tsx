import { act, renderHook } from "@testing-library/react-native";
import {
  SEARCH_REQUEST_DEBOUNCE_MS,
  useSearchRequestDebounce,
} from "../application/useSearchRequestDebounce";

describe("useSearchRequestDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("coalesces rapid search scope updates into one debounced network scope", () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useSearchRequestDebounce>,
      { query: string }
    >(
      ({ query }) =>
        useSearchRequestDebounce({
          category: "",
          fee: "",
          query,
          sort: "newest",
          university: "",
        }),
      {
        initialProps: { query: "" },
      },
    );

    rerender({ query: "a" });
    rerender({ query: "ab" });
    rerender({ query: "abc" });

    expect(result.current.debouncedInput.query).toBe("");

    act(() => {
      jest.advanceTimersByTime(SEARCH_REQUEST_DEBOUNCE_MS - 1);
    });

    expect(result.current.debouncedInput.query).toBe("");

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current.debouncedInput.query).toBe("abc");
    expect(result.current.debouncedScope).toContain('"q":"abc"');
  });
});
