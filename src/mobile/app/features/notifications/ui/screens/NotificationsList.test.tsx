import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { NotificationItem } from "../../data";
import { NotificationsList, resolveNotificationDayLabel } from "./NotificationsList";

let mockListProps: Record<string, any> = {};

jest.mock("../../../../shared/components", () => ({
  AppFlatList: (props: Record<string, any>) => {
    const React = require("react");
    const { View } = require("react-native");
    mockListProps = props;
    return (
      <View testID="notifications-list">
        {props.ListHeaderComponent}
        {props.data.map((item: Record<string, unknown>, index: number) => (
          <React.Fragment key={item.id}>
            {props.renderItem({ item, index })}
            {index === 0 ? props.ItemSeparatorComponent() : null}
          </React.Fragment>
        ))}
      </View>
    );
  },
}));

jest.mock("./NotificationListItem", () => ({
  NotificationListItem: ({
    item,
    onPress,
  }: {
    item: Record<string, unknown>;
    onPress: () => void;
  }) => {
    const { Text } = require("react-native");
    return (
      <Text accessibilityRole="button" onPress={onPress}>
        {item.id}
      </Text>
    );
  },
}));

jest.mock("./NotificationsFollowRequestsCard", () => ({
  NotificationsFollowRequestsCard: () => {
    const { Text } = require("react-native");
    return <Text>follow requests</Text>;
  },
}));

function createNotification(id: string, createdAt: string): NotificationItem {
  return {
    createdAt,
    fromImage: "",
    fromName: "Test User",
    fromUserId: "actor-id",
    fromUsername: "test-user",
    id,
    message: "bildirim",
    read: false,
    targetType: "profile",
    time: "simdi",
    type: "system",
  };
}

const baseProps = {
  activeFilter: "all" as const,
  bottomInset: 10,
  handleFollowRequestAction: jest.fn(),
  handleInlineFollowRequestAction: jest.fn(),
  handleNotifPress: jest.fn(async () => undefined),
  hasMore: true,
  loadMore: jest.fn(async () => undefined),
  loadingMore: false,
  notificationsHasError: false,
  notificationsShowInitialSkeleton: false,
  onRefresh: jest.fn(async () => undefined),
  openProfile: jest.fn(),
  pendingFollowRequestSet: new Set<string>(),
  pendingFollowRequests: {},
  pendingInlineFollowRequests: {},
  processedFollowRequests: {},
  processedInlineFollowRequests: {},
  refreshing: false,
  visibleFollowRequests: [{ id: "request-1" }] as never[],
};

describe("resolveNotificationDayLabel", () => {
  const now = new Date(2026, 6, 21, 12);

  it.each([
    ["not-a-date", "Daha eski"],
    [new Date(2026, 6, 21, 8).toISOString(), "Bugün"],
    [new Date(2026, 6, 22, 8).toISOString(), "Bugün"],
    [new Date(2026, 6, 20, 8).toISOString(), "Dün"],
    [new Date(2026, 6, 17, 8).toISOString(), "Bu hafta"],
    [new Date(2026, 6, 1, 8).toISOString(), "Daha eski"],
  ])("groups %s as %s", (value, expected) => {
    expect(resolveNotificationDayLabel(value, now)).toBe(expected);
  });
});

describe("NotificationsList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListProps = {};
  });

  it("renders grouped rows, opens a notification, and requests the next page", () => {
    const items = [
      createNotification("first", "2026-07-21T08:00:00.000Z"),
      createNotification("second", "2026-07-20T08:00:00.000Z"),
    ];
    render(<NotificationsList {...baseProps} listItems={items} />);

    expect(screen.getByText("follow requests")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("first"));
    mockListProps.onEndReached();

    expect(baseProps.handleNotifPress).toHaveBeenCalledWith(items[0]);
    expect(baseProps.loadMore).toHaveBeenCalledTimes(1);
    expect(mockListProps.getItemType(items[0])).toBe("system");
    expect(mockListProps.keyExtractor(items[0])).toBe("first");
  });

  it("does not load another page while loading and hides follow requests outside social filters", () => {
    render(<NotificationsList {...baseProps} activeFilter="comment" listItems={[]} loadingMore />);

    expect(screen.queryByText("follow requests")).not.toBeOnTheScreen();
    mockListProps.onEndReached();
    expect(baseProps.loadMore).not.toHaveBeenCalled();
  });
});
