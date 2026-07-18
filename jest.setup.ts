import "@testing-library/jest-native/extend-expect";

const mockSecureStoreState = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => ({
  __store: mockSecureStoreState,
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreState.delete(key);
  }),
  getItemAsync: jest.fn(async (key: string) =>
    mockSecureStoreState.has(key) ? (mockSecureStoreState.get(key) ?? null) : null,
  ),
  isAvailableAsync: jest.fn(async () => true),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreState.set(key, value);
  }),
}));

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useIsFocused: () => false,
}));

jest.mock("expo-linking", () => ({
  createURL: (path = "", options?: { scheme?: string }) => {
    const mockScheme = options?.scheme || "test";
    const normalizedPath = String(path).replace(/^\/+/, "");
    return normalizedPath ? `${mockScheme}://${normalizedPath}` : `${mockScheme}://`;
  },
}));

jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  removeNotificationSubscription: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  scheduleNotificationAsync: jest.fn(async () => "scheduled-notification-id"),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

jest.mock("expo-splash-screen", () => ({
  hideAsync: jest.fn(async () => undefined),
  preventAutoHideAsync: jest.fn(async () => true),
  setOptions: jest.fn(),
}));

jest.mock("expo-video", () => ({
  VideoView: "VideoView",
  useVideoPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
  })),
}));

jest.mock("lucide-react-native", () => {
  return new Proxy(
    {},
    {
      get: (_target, iconName) => {
        const mockIconName = String(iconName);
        return function MockLucideIcon() {
          return mockIconName;
        };
      },
    },
  );
});

afterEach(() => {
  mockSecureStoreState.clear();
});
