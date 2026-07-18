import { act, renderHook } from "@testing-library/react-native";

const mockStopObservedTimer = jest.fn();
const mockConfirmExit = jest.fn(() => true);
const mockResetExitIntent = jest.fn();

jest.mock("../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => mockStopObservedTimer),
}));

jest.mock("./useExitIntentGuard", () => ({
  useExitIntentGuard: () => ({
    confirmExit: mockConfirmExit,
    exitMessage: "",
    resetExitIntent: mockResetExitIntent,
  }),
}));

import { useRootNavigationController } from "./useRootNavigationController";

describe("useRootNavigationController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates tab feedback immediately and coalesces duplicate transition intents", () => {
    const navigationRef = {
      canGoBack: jest.fn(() => false),
      getCurrentRoute: jest.fn(() => ({ name: "Home" })),
      getRootState: jest.fn(() => ({
        index: 0,
        key: "root",
        routeNames: ["MainTabsNavigator"],
        routes: [
          {
            key: "tabs",
            name: "MainTabsNavigator",
            state: { index: 0, routes: [{ key: "home", name: "Home" }] },
          },
        ],
        stale: false,
        type: "stack",
      })),
      isReady: jest.fn(() => true),
      navigate: jest.fn(),
    };
    const { result } = renderHook(() =>
      useRootNavigationController({
        accountType: "student",
        isLoading: false,
        isLoggedIn: true,
        navigationRef: navigationRef as never,
        setBottomTabsVisible: jest.fn(),
        triggerTabReselect: jest.fn(),
      }),
    );

    act(() => {
      result.current.handleSearchPress();
      result.current.handleSearchPress();
    });

    expect(result.current.currentTab).toBe("search");
    expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
  });
});
