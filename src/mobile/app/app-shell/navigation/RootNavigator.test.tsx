import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { RootNavigator } from "./RootNavigator";

const mockHideNativeSplashScreen = jest.fn();
const mockRegisterNavigationContainer = jest.fn();
const mockUseAuth = jest.fn();
const mockUseAppStartupState = jest.fn();
const mockUseRootNavigationController = jest.fn();
const mockNavigationRef = {
  isReady: jest.fn(() => true),
};

jest.mock("@react-navigation/native", () => {
  const React = require("react");
  return {
    DefaultTheme: {
      colors: {
        background: "#fff",
        border: "#000",
        card: "#fff",
        notification: "#f00",
        primary: "#00f",
        text: "#000",
      },
    },
    NavigationContainer: ({
      children,
      onReady,
      onStateChange,
    }: {
      children: React.ReactNode;
      onReady?: () => void;
      onStateChange?: () => void;
    }) => {
      React.useEffect(() => {
        onReady?.();
        onStateChange?.();
      }, [onReady, onStateChange]);
      return React.createElement(React.Fragment, null, children);
    },
    useNavigationContainerRef: () => mockNavigationRef,
  };
});

jest.mock("../auth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../startup/AppStartupState", () => ({
  useAppStartupState: () => mockUseAppStartupState(),
}));

jest.mock("../startup/nativeSplash", () => ({
  hideNativeSplashScreen: (...args: unknown[]) => mockHideNativeSplashScreen(...args),
}));

jest.mock("../startup/StartupSplashScreen", () => ({
  StartupSplashScreen: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, { testID: "startup-splash-overlay" }, "splash");
  },
}));

jest.mock("./ChromeVisibilityContext", () => ({
  useBottomTabsVisible: () => true,
  useSetBottomTabsVisible: () => jest.fn(),
}));

jest.mock("./TabReselectContext", () => ({
  useTriggerTabReselect: () => jest.fn(),
}));

jest.mock("./useRootNavigationController", () => ({
  useRootNavigationController: () => mockUseRootNavigationController(),
}));

jest.mock("./hooks/useTabLandingPrefetch", () => ({
  useTabLandingPrefetch: jest.fn(),
}));

jest.mock("./rootNavigationScreens", () => ({
  RootNavigatorScreens: ({ showAuthenticatedShell }: { showAuthenticatedShell: boolean }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(
      Text,
      { testID: "root-shell" },
      showAuthenticatedShell ? "app-shell" : "auth-shell",
    );
  },
}));

jest.mock("./components/MainBottomTabs", () => ({
  MainBottomTabs: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, { testID: "bottom-tabs" }, "tabs");
  },
}));

jest.mock("../bridges/usePushNotificationResponseBridge", () => ({
  usePushNotificationResponseBridge: () => undefined,
}));

jest.mock("./bridges/useSupabaseDeepLinkBridge", () => ({
  useSupabaseDeepLinkBridge: () => undefined,
}));

jest.mock("../../platform/observability", () => ({
  registerNavigationContainer: (...args: unknown[]) => mockRegisterNavigationContainer(...args),
}));

jest.mock("../../shared/components", () => ({
  FeedToast: () => null,
}));

jest.mock("../onboarding", () => ({
  OnboardingCoordinator: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, { testID: "onboarding" }, "onboarding");
  },
}));

jest.mock("../feedback/AppUploadActivityBar", () => ({
  AppUploadActivityBar: () => null,
}));

jest.mock("../feedback/AppNetworkStatusBanner", () => ({
  AppNetworkStatusBanner: () => null,
}));

describe("RootNavigator", () => {
  let authState: ReturnType<typeof mockUseAuth>;
  let controllerState: ReturnType<typeof mockUseRootNavigationController>;
  let requestAnimationFrameSpy: jest.SpyInstance;
  let cancelAnimationFrameSpy: jest.SpyInstance;

  beforeEach(() => {
    mockHideNativeSplashScreen.mockReset();
    mockRegisterNavigationContainer.mockReset();
    mockNavigationRef.isReady.mockReturnValue(true);

    authState = {
      accountType: "student",
      authBootState: "signed_in_hydrated",
      isAuthBootstrapPending: false,
      isLoading: false,
      isLoggedIn: true,
      userData: { id: "viewer-1", username: "viewer" },
    };

    controllerState = {
      accountType: "student",
      currentRoute: "Home",
      currentTab: "home",
      exitMessage: "",
      handleCreatePress: jest.fn(),
      handleHomePress: jest.fn(),
      handleHardwareBack: jest.fn(() => false),
      handleProfilePress: jest.fn(),
      handleReady: jest.fn(),
      handleSearchPress: jest.fn(),
      handleStateChange: jest.fn(),
      showAppTabs: true,
    };

    mockUseAuth.mockImplementation(() => authState);
    mockUseAppStartupState.mockReturnValue({
      queryCacheReady: true,
      queryRestoreReady: true,
    });
    mockUseRootNavigationController.mockImplementation(() => controllerState);

    requestAnimationFrameSpy = jest
      .spyOn(global, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(Date.now());
        return 0;
      });
    cancelAnimationFrameSpy = jest
      .spyOn(global, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  async function flushStartup() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("opens directly into the authenticated shell after splash for signed-in launches", async () => {
    render(<RootNavigator />);

    await flushStartup();

    await waitFor(() => {
      expect(screen.getByTestId("root-shell")).toHaveTextContent("app-shell");
    });
    expect(screen.getByTestId("bottom-tabs")).toBeTruthy();
    expect(screen.queryByTestId("startup-splash-overlay")).toBeNull();
    expect(mockHideNativeSplashScreen).toHaveBeenCalledTimes(1);
  });

  it("opens directly into the auth shell after splash for signed-out launches", async () => {
    authState = {
      ...authState,
      authBootState: "signed_out",
      isLoggedIn: false,
      userData: { id: undefined, username: "" },
    };
    controllerState = {
      ...controllerState,
      currentRoute: "Welcome",
      showAppTabs: false,
    };
    mockUseAuth.mockImplementation(() => authState);
    mockUseRootNavigationController.mockImplementation(() => controllerState);

    render(<RootNavigator />);

    await flushStartup();

    await waitFor(() => {
      expect(screen.getByTestId("root-shell")).toHaveTextContent("auth-shell");
    });
    expect(screen.queryByTestId("bottom-tabs")).toBeNull();
    expect(screen.queryByTestId("startup-splash-overlay")).toBeNull();
  });

  it("switches straight to the auth shell on logout without reopening app tabs", async () => {
    const rendered = render(<RootNavigator />);

    await flushStartup();
    expect(screen.getByTestId("root-shell")).toHaveTextContent("app-shell");

    authState = {
      ...authState,
      authBootState: "signed_out",
      isLoggedIn: false,
      userData: { id: undefined, username: "" },
    };
    controllerState = {
      ...controllerState,
      currentRoute: "Welcome",
      showAppTabs: false,
    };
    mockUseAuth.mockImplementation(() => authState);
    mockUseRootNavigationController.mockImplementation(() => controllerState);

    rendered.rerender(<RootNavigator />);
    await flushStartup();

    expect(screen.getByTestId("root-shell")).toHaveTextContent("auth-shell");
    expect(screen.queryByTestId("bottom-tabs")).toBeNull();
  });
});
