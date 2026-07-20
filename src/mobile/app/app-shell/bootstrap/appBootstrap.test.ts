const mockIgnoreLogs = jest.fn();
const mockInitNetworkBudgetListener = jest.fn();
const mockSubscribeNetworkQuality = jest.fn((_listener?: unknown) => jest.fn());
const mockSetOnline = jest.fn();
const mockRehydrateHomeStartupSnapshots = jest.fn(async () => undefined);
const mockRehydratePersistedMediaUriCache = jest.fn(async () => undefined);
const mockConfigureMediaUrlResolver = jest.fn();

jest.mock("react-native", () => ({
  LogBox: { ignoreLogs: (...args: unknown[]) => mockIgnoreLogs(...args) },
}));
jest.mock("@tanstack/react-query", () => ({
  onlineManager: { setOnline: (...args: unknown[]) => mockSetOnline(...args) },
}));
jest.mock("../../data/projections/networkAwareBudget", () => ({
  getNetworkQuality: () => "good",
  initNetworkBudgetListener: () => mockInitNetworkBudgetListener(),
  subscribeNetworkQuality: (listener: unknown) => mockSubscribeNetworkQuality(listener),
}));
jest.mock("../../data/query/queryClient", () => ({
  queryClient: {
    refetchQueries: jest.fn(),
    resumePausedMutations: jest.fn(),
  },
}));
jest.mock("../../features/home/public/warmup", () => ({
  rehydrateHomeStartupSnapshots: () => mockRehydrateHomeStartupSnapshots(),
}));
jest.mock("../../platform/media/getSignedMediaUrl", () => ({
  getSignedMediaUrl: jest.fn(),
  getSignedMediaUrls: jest.fn(),
  SIGNED_MEDIA_URL_CACHE_TTL_MS: 60_000,
}));
jest.mock("../../shared/media/mediaUrlResolver", () => ({
  configureMediaUrlResolver: (...args: unknown[]) => mockConfigureMediaUrlResolver(...args),
}));
jest.mock("../../shared/media/mediaUri", () => ({
  rehydratePersistedMediaUriCache: () => mockRehydratePersistedMediaUriCache(),
}));

import { hydrateStartupCaches, initializeAppBootstrap } from "./appBootstrap";

describe("initializeAppBootstrap", () => {
  it("hydrates independent startup caches in parallel and only initializes once", async () => {
    const firstInitialization = initializeAppBootstrap();

    expect(mockRehydrateHomeStartupSnapshots).toHaveBeenCalledTimes(1);
    expect(mockRehydratePersistedMediaUriCache).toHaveBeenCalledTimes(1);

    await firstInitialization;
    await initializeAppBootstrap();
    await hydrateStartupCaches();

    expect(mockRehydrateHomeStartupSnapshots).toHaveBeenCalledTimes(1);
    expect(mockRehydratePersistedMediaUriCache).toHaveBeenCalledTimes(1);
    expect(mockInitNetworkBudgetListener).toHaveBeenCalledTimes(1);
    expect(mockConfigureMediaUrlResolver).toHaveBeenCalledTimes(1);
  });
});
