import React from "react";
import { AccessibilityInfo } from "react-native";
import { act, render } from "@testing-library/react-native";
import { BlockedUsersScreen } from "./BlockedUsersScreen";

const mockHandleUnblock = jest.fn(async () => true);
const mockOpenProfile = jest.fn();
let mockButtonProps: Record<string, unknown> | null = null;
let mockConfirmation: { onConfirm: () => Promise<void> } | null = null;

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  };
});
jest.mock("../../../../app-shell/auth", () => ({
  useAuth: () => ({
    blockedUsers: ["blocked"],
    unblockUser: jest.fn(async () => undefined),
    userData: { id: "viewer-id", username: "viewer" },
  }),
}));
jest.mock("../../../../app-shell/navigation/hooks/useIntentNavigation", () => ({
  useOpenProfile: () => mockOpenProfile,
}));
jest.mock("../../../../shared/layout/bottomNavSpacing", () => ({
  useBottomNavPadding: () => 20,
}));
jest.mock("../../../../shared/i18n", () => ({
  t: (key: string) => key,
}));
jest.mock("../../../../shared/components/AppText", () => {
  const { Text } = require("react-native");
  return { AppText: Text };
});
jest.mock("../../../../shared/components", () => {
  const ReactModule = require("react");
  return {
    AppButton: (props: Record<string, unknown>) => {
      mockButtonProps = props;
      return null;
    },
    AppFlatList: (props: {
      data: unknown[];
      renderItem: (params: { item: unknown }) => React.ReactNode;
    }) =>
      ReactModule.createElement(
        ReactModule.Fragment,
        null,
        props.renderItem({ item: props.data[0] }),
      ),
    AppImage: () => null,
    BackHeader: () => null,
    EmptyState: () => null,
  };
});
jest.mock("../../application/useBlockedUsersScreenState", () => ({
  useBlockedUsersScreenState: () => ({
    blockedData: [
      {
        image: null,
        isPrivate: false,
        name: "Blocked User",
        university: "Üniversite",
        userId: "blocked-id",
        username: "blocked",
      },
    ],
    blockedProjection: { onRefresh: jest.fn(), refreshing: false },
    handleBack: jest.fn(),
    handleUnblock: mockHandleUnblock,
    shouldShowInitialSkeleton: false,
  }),
}));
jest.mock("../../../../shared/utils/alerts", () => ({
  showConfirmAlert: (request: { onConfirm: () => Promise<void> }) => {
    mockConfirmation = request;
  },
}));

describe("BlockedUsersScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockButtonProps = null;
    mockConfirmation = null;
  });

  it("confirms unblocking and announces a successful mutation", async () => {
    const announceSpy = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
    const navigation = {
      canGoBack: () => true,
      goBack: jest.fn(),
    } as never;

    render(<BlockedUsersScreen navigation={navigation} route={{} as never} />);
    act(() => (mockButtonProps?.onPress as () => void)());
    await act(async () => {
      await mockConfirmation?.onConfirm();
    });

    expect(mockHandleUnblock).toHaveBeenCalledWith("blocked");
    expect(announceSpy).toHaveBeenCalled();
    announceSpy.mockRestore();
  });
});
