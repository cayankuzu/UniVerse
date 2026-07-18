import React from "react";
import { render, screen } from "@testing-library/react-native";
import { NotificationsScreen } from "./NotificationsScreen";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("../../../../app-shell/auth", () => ({
  useAuth: () => ({
    authBootState: "signed_in_hydrated",
    blockedUsers: [],
    userData: {
      id: "viewer-id",
      username: "viewer",
    },
  }),
}));

jest.mock("../../../../app-shell/navigation/hooks/useNotificationNavigation", () => ({
  useNotificationNavigation: () => jest.fn(),
}));

jest.mock("../../../../app-shell/navigation/hooks/useIntentNavigation", () => ({
  useOpenProfile: () => jest.fn(),
}));

jest.mock("../../application/useNotificationsInbox", () => ({
  useNotificationsInbox: () => ({
    activeFilter: "all",
    filterCounts: { all: 1, club: 0, comment: 0, like: 1, social: 0 },
    handleFollowRequestAction: jest.fn(),
    handleInlineFollowRequestAction: jest.fn(),
    handleNotifPress: jest.fn().mockResolvedValue(undefined),
    listItems: [
      {
        fromImage: "",
        fromName: "Test User",
        id: "notification-1",
        message: "fotoğrafını beğendi",
        read: false,
        time: "simdi",
        type: "like",
      },
    ],
    loadMore: jest.fn().mockResolvedValue(undefined),
    loadingMore: false,
    markReadMutation: {
      isPending: false,
      mutate: jest.fn(),
    },
    notice: null,
    notificationsQuery: {
      error: null,
    },
    notificationsShowInitialSkeleton: false,
    onRefresh: jest.fn().mockResolvedValue(undefined),
    pendingFollowRequestSet: new Set<string>(),
    pendingFollowRequests: {},
    pendingInlineFollowRequests: {},
    processedFollowRequests: {},
    processedInlineFollowRequests: {},
    refreshing: false,
    setActiveFilter: jest.fn(),
    unreadCount: 1,
    visibleFilters: [
      {
        color: "#2563eb",
        icon: () => null,
        key: "all",
        label: "Tum",
      },
    ],
    visibleFollowRequests: [],
  }),
}));

jest.mock("./NotificationsHeader", () => ({
  NotificationsHeader: ({ unreadCount }: { unreadCount: number }) => {
    const { Text } = require("react-native");
    return <Text>{`header-${unreadCount}`}</Text>;
  },
}));

jest.mock("./NotificationsNotice", () => ({
  NotificationsNotice: () => null,
}));

jest.mock("./NotificationsList", () => ({
  NotificationsList: ({ listItems }: { listItems: Array<{ id: string }> }) => {
    const { Text } = require("react-native");
    return <Text>{`list-${listItems.length}`}</Text>;
  },
}));

describe("NotificationsScreen", () => {
  it("renders the header and list shell", () => {
    render(
      <NotificationsScreen
        navigation={
          {
            goBack: jest.fn(),
          } as never
        }
        route={{ key: "Notifications", name: "Notifications" } as never}
      />,
    );

    expect(screen.getByText("header-1")).toBeOnTheScreen();
    expect(screen.getByText("list-1")).toBeOnTheScreen();
  });
});
