import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { NotificationItem } from "../../../data/contracts/api";
import { useNotificationReadMutations } from "./useNotificationReadMutations";

jest.mock("../data", () => ({
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

const { markAllNotificationsRead, markNotificationRead } = jest.requireMock("../data") as {
  markAllNotificationsRead: jest.Mock;
  markNotificationRead: jest.Mock;
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function flushQueryNotifications() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function createNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    fromImage: "",
    fromName: "Test User",
    fromUserId: "user-1",
    fromUsername: "test-user",
    id: "notification-1",
    message: "bir seyi beğendi",
    read: false,
    createdAt: "2026-03-31T10:00:00.000Z",
    targetType: "profile",
    time: "simdi",
    type: "like",
    ...overrides,
  };
}

describe("useNotificationReadMutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks unread notifications on first tap and opens immediately after the read succeeds", async () => {
    const queryClient = createQueryClient();
    const notification = createNotification();
    const navigateForNotification = jest.fn();
    markNotificationRead.mockResolvedValue({ success: true });

    const { result } = renderHook(
      () =>
        useNotificationReadMutations({
          badgeKey: ["badge", "notifications", "viewer"],
          navigateForNotification,
          notifications: [notification],
          notificationsKey: ["screen", "notifications", "viewer", "all"],
          optimisticOutbox: {
            begin: jest.fn(),
            fail: jest.fn(),
            resolve: jest.fn(),
          },
          unreadNotificationCount: 1,
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.handleNotifPress(notification);
    });
    await flushQueryNotifications();

    expect(markNotificationRead).toHaveBeenCalledTimes(1);
    expect(navigateForNotification).toHaveBeenCalledWith(notification);
    expect(queryClient.getQueryData(["badge", "notifications", "viewer"])).toEqual({
      id: "notifications",
      unreadCount: 0,
    });
  });

  it("opens already-read notifications immediately", async () => {
    const queryClient = createQueryClient();
    const notification = createNotification({ id: "notification-2", read: true });
    const navigateForNotification = jest.fn();

    const { result } = renderHook(
      () =>
        useNotificationReadMutations({
          badgeKey: ["badge", "notifications", "viewer"],
          navigateForNotification,
          notifications: [notification],
          notificationsKey: ["screen", "notifications", "viewer", "all"],
          optimisticOutbox: {
            begin: jest.fn(),
            fail: jest.fn(),
            resolve: jest.fn(),
          },
          unreadNotificationCount: 0,
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.handleNotifPress(notification);
    });
    await flushQueryNotifications();

    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(navigateForNotification).toHaveBeenCalledWith(notification);
  });

  it("still navigates immediately (fire-and-forget) but rolls back optimistic read state when the read mutation fails", async () => {
    const queryClient = createQueryClient();
    const notification = createNotification({ id: "notification-3" });
    const navigateForNotification = jest.fn();
    markNotificationRead.mockResolvedValue({ success: false });

    const { result } = renderHook(
      () =>
        useNotificationReadMutations({
          badgeKey: ["badge", "notifications", "viewer"],
          navigateForNotification,
          notifications: [notification],
          notificationsKey: ["screen", "notifications", "viewer", "all"],
          optimisticOutbox: {
            begin: jest.fn(),
            fail: jest.fn(),
            resolve: jest.fn(),
          },
          unreadNotificationCount: 1,
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.handleNotifPress(notification);
    });
    await flushQueryNotifications();

    expect(navigateForNotification).toHaveBeenCalledWith(notification);
    expect(queryClient.getQueryData(["entity", "notifications", "notification-3"])).toEqual({
      id: "notification-3",
      read: false,
    });
    expect(queryClient.getQueryData(["badge", "notifications", "viewer"])).toEqual({
      id: "notifications",
      unreadCount: 1,
    });
  });

  it("treats mark-all-read failures as mutation errors", async () => {
    const queryClient = createQueryClient();
    const notification = createNotification({ id: "notification-4" });
    markAllNotificationsRead.mockResolvedValue({ success: false });

    const { result } = renderHook(
      () =>
        useNotificationReadMutations({
          badgeKey: ["badge", "notifications", "viewer"],
          navigateForNotification: jest.fn(),
          notifications: [notification],
          notificationsKey: ["screen", "notifications", "viewer", "all"],
          optimisticOutbox: {
            begin: jest.fn(),
            fail: jest.fn(),
            resolve: jest.fn(),
          },
          unreadNotificationCount: 1,
          viewerKey: "viewer",
        }),
      { wrapper: createWrapper(queryClient) },
    );

    let mutationError: unknown = null;
    await act(async () => {
      try {
        await result.current.markReadMutation.mutateAsync({
          clientMutationId: "mut-1",
        });
      } catch (error) {
        mutationError = error;
      }
    });
    await flushQueryNotifications();

    expect(mutationError).toEqual(
      expect.objectContaining({
        message: "notifications-mark-all-read-failed",
      }),
    );
  });
});
