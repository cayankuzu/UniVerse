import * as Notifications from "expo-notifications";
import {
  hasNotificationPermission,
  requestNotificationPermissionFromUserInteraction,
  subscribeNotificationPermissionGranted,
} from "./notificationPermission";
import { ensureAndroidNotificationChannel } from "./notificationChannel";

jest.mock("./notificationChannel", () => ({
  ensureAndroidNotificationChannel: jest.fn(async () => undefined),
}));

describe("notificationPermission", () => {
  const getPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
  const requestPermissionsAsync = Notifications.requestPermissionsAsync as jest.Mock;
  const mockEnsureAndroidNotificationChannel = ensureAndroidNotificationChannel as jest.Mock;

  beforeEach(() => {
    getPermissionsAsync.mockReset();
    requestPermissionsAsync.mockReset();
    mockEnsureAndroidNotificationChannel.mockClear();
  });

  it("requests permission only after the explicit interaction and signals registration", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeNotificationPermissionGranted(listener);
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    requestPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });

    await expect(requestNotificationPermissionFromUserInteraction()).resolves.toBe(true);

    expect(mockEnsureAndroidNotificationChannel).toHaveBeenCalledTimes(1);
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not re-prompt after the permission was denied", async () => {
    getPermissionsAsync.mockResolvedValue({ granted: false, status: "denied" });

    await expect(requestNotificationPermissionFromUserInteraction()).resolves.toBe(false);

    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("returns immediately when permission is already granted", async () => {
    getPermissionsAsync.mockResolvedValue({ granted: true, status: "granted" });

    await expect(requestNotificationPermissionFromUserInteraction()).resolves.toBe(true);

    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("accepts the explicit iOS authorized status even if the root status is absent", () => {
    const authorized = Notifications.IosAuthorizationStatus.AUTHORIZED;

    expect(
      hasNotificationPermission({
        granted: false,
        ios: { status: authorized },
        status: "undetermined",
      } as Notifications.NotificationPermissionsStatus),
    ).toBe(true);
  });
});
