import { act, renderHook } from "@testing-library/react-native";
import { useSearchUiState } from "./useSearchUiState";

jest.mock("../data", () => ({
  getCachedWarmupPreferences: () => ({}),
  SEARCH_DISCOVERY_SCOPE: "discovery",
}));
jest.mock("./useSearchRequestDebounce", () => ({
  useSearchRequestDebounce: () => ({
    debouncedInput: {
      category: "",
      fee: "",
      query: "",
      sort: "newest",
      university: "",
    },
    debouncedScope: "search-scope",
  }),
}));
jest.mock("./useSearchScopeRestore", () => ({
  useSearchScopeRestore: () => ({ persistedSearchScopeRef: { current: null }, restoreReady: true }),
}));
jest.mock("../../../shared/hooks/useScrollToTopOnReselect", () => ({
  useScrollToTopOnReselect: jest.fn(),
}));
jest.mock("../../../shared/hooks/useAutoClearingMessage", () => ({
  useAutoClearingMessage: () => ({ message: null, setMessage: jest.fn() }),
}));

describe("useSearchUiState", () => {
  it("switches tabs without clearing the user's search filters", () => {
    const { result } = renderHook(() =>
      useSearchUiState({ searchReselectCounter: 0, viewerKey: "viewer-1" }),
    );

    act(() => result.current.setSelectedCategory("music"));
    act(() => result.current.setShowFilters(true));
    act(() => result.current.onSelectType("events"));

    expect(result.current.type).toBe("events");
    expect(result.current.showFilters).toBe(false);
    expect(result.current.selectedCategory).toBe("music");
  });
});
