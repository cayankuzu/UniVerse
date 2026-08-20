import { requestNotificationPermissionFromUserInteraction } from "../notifications/notificationPermission";
import {
  readDevicePermissionStateProgressively,
  requestDevicePermission,
} from "./devicePermissions";

jest.mock("../notifications/pushRuntime", () => ({
  resolvePushPlatform: jest.fn(() => "android"),
}));
jest.mock("../notifications/notificationPermission", () => ({
  hasNotificationPermission: jest.fn(() => true),
  requestNotificationPermissionFromUserInteraction: jest.fn(async () => true),
}));
jest.mock("expo-notifications", () => ({
  __esModule: true,
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted" })),
}));
jest.mock("expo-camera", () => ({
  __esModule: true,
  Camera: {
    getCameraPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    getMicrophonePermissionsAsync: jest.fn(async () => ({ status: "denied" })),
    requestCameraPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    requestMicrophonePermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  },
}));
jest.mock("expo-media-library", () => ({
  __esModule: true,
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
}));

const mockRequestNotificationPermissionFromUserInteraction =
  requestNotificationPermissionFromUserInteraction as jest.Mock;

describe("devicePermissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads each permission progressively and normalizes notification grants", async () => {
    const onUpdate = jest.fn();

    await expect(readDevicePermissionStateProgressively(onUpdate)).resolves.toEqual({
      camera: "granted",
      microphone: "denied",
      notifications: "granted",
      photos: "granted",
    });
    expect(onUpdate).toHaveBeenCalledTimes(4);
  });

  it("maps an explicit notification interaction to a granted state", async () => {
    await expect(requestDevicePermission("notifications")).resolves.toBe("granted");
    expect(mockRequestNotificationPermissionFromUserInteraction).toHaveBeenCalled();
  });
});
