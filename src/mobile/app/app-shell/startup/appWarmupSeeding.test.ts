import { getProjectionWarmupBundle } from "../../data/projections/projections.warmup";
import {
  logProjectionMetric,
  logScreenView,
  startObservedTimer,
} from "../../platform/observability";
import { scheduleAfterInteractions } from "../../shared/utils/scheduleAfterInteractions";
import { getWarmupBundleSize, seedWarmupBundleIntoCache } from "./appWarmupCache";
import { prepareWarmupSeedCache } from "./appWarmupSeeding.cache";
import { seedAppWarmupBundle } from "./appWarmupSeeding";

jest.mock("../../data/projections/projections.warmup", () => ({
  getProjectionWarmupBundle: jest.fn(),
}));
jest.mock("../../platform/observability", () => ({
  logProjectionMetric: jest.fn(),
  logScreenView: jest.fn(),
  startObservedTimer: jest.fn(),
}));
jest.mock("../../shared/utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: jest.fn(),
}));
jest.mock("./appWarmupCache", () => ({
  getWarmupBundleSize: jest.fn(),
  seedWarmupBundleIntoCache: jest.fn(),
}));
jest.mock("./appWarmupSeeding.cache", () => ({
  prepareWarmupSeedCache: jest.fn(),
}));

const mockedGetBundle = getProjectionWarmupBundle as jest.MockedFunction<
  typeof getProjectionWarmupBundle
>;
const mockedPrepareCache = prepareWarmupSeedCache as jest.MockedFunction<
  typeof prepareWarmupSeedCache
>;
const mockedSchedule = scheduleAfterInteractions as jest.MockedFunction<
  typeof scheduleAfterInteractions
>;
const mockedStartTimer = startObservedTimer as jest.MockedFunction<typeof startObservedTimer>;

const bundle = {
  generatedAt: "2026-07-20T00:00:00.000Z",
  home: { entities: {}, generatedAt: "2026-07-20T00:00:00.000Z", ids: [] },
  homeScope: "all:all:all:newest",
  notificationBadge: { id: "notifications", unreadCount: 0 },
  source: "rpc" as const,
};

function createParams(overrides: Record<string, unknown> = {}) {
  return {
    prefetchedImageUris: new Set<string>(),
    queryClient: {} as any,
    reason: "startup" as const,
    reportWarmupFailure: jest.fn(),
    runIdleWarmup: jest.fn().mockResolvedValue(undefined),
    viewerId: "viewer-1",
    viewerKey: "viewer-1",
    viewerUsername: "viewer",
    ...overrides,
  };
}

describe("seedAppWarmupBundle", () => {
  const stopTelemetry = jest.fn();
  const cancel = jest.fn();
  let scheduledTask: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduledTask = undefined;
    mockedStartTimer.mockReturnValue(stopTelemetry);
    mockedSchedule.mockImplementation((task) => {
      scheduledTask = task;
      return { cancel } as any;
    });
    (getWarmupBundleSize as jest.Mock).mockReturnValue({ homeItems: 0 });
    mockedGetBundle.mockResolvedValue(bundle as any);
  });

  it("stops before the RPC when cache or a screen query is already active", async () => {
    mockedPrepareCache.mockResolvedValue({
      homeItemCount: 1,
      homeItems: [],
      preferences: {} as any,
      preferredHomeScope: "all:all:all:newest",
      shouldRequestWarmup: false,
    });

    const result = await seedAppWarmupBundle(createParams());

    expect(result.cancelIdleTask).toBeNull();
    expect(mockedGetBundle).not.toHaveBeenCalled();
    expect(stopTelemetry).toHaveBeenCalledWith("skipped", {
      reason: "cache-or-screen-query-active",
    });
  });

  it("seeds the RPC bundle, runs idle work and exposes cancellation", async () => {
    mockedPrepareCache.mockResolvedValue({
      homeItemCount: 0,
      homeItems: [],
      preferences: { lastHomeScope: { scope: "clubs:newest" } } as any,
      preferredHomeScope: "clubs:newest",
      shouldRequestWarmup: true,
    });
    const params = createParams({ reason: "foreground-stale" as const });

    const result = await seedAppWarmupBundle(params);
    scheduledTask?.();
    await Promise.resolve();
    result.cancelIdleTask?.();

    expect(mockedGetBundle).toHaveBeenCalledWith({
      home: { scope: "clubs:newest" },
      viewerId: "viewer-1",
      viewerUsername: "viewer",
    });
    expect(seedWarmupBundleIntoCache).toHaveBeenCalled();
    expect(params.runIdleWarmup).toHaveBeenCalledWith(bundle);
    expect(cancel).toHaveBeenCalled();
    expect(logProjectionMetric).toHaveBeenCalled();
    expect(logScreenView).toHaveBeenCalledWith(
      expect.objectContaining({ name: "foreground_sync_latency", status: "ok" }),
    );
  });

  it("reports deferred idle failures without rejecting the completed seed", async () => {
    mockedPrepareCache.mockResolvedValue({
      homeItemCount: 0,
      homeItems: [],
      preferences: {} as any,
      preferredHomeScope: "all:all:all:newest",
      shouldRequestWarmup: true,
    });
    const failure = new Error("idle failed");
    const params = createParams({ runIdleWarmup: jest.fn().mockRejectedValue(failure) });

    await seedAppWarmupBundle(params);
    scheduledTask?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(params.reportWarmupFailure).toHaveBeenCalledWith("idle", failure);
  });

  it("records and rethrows warmup preparation failures", async () => {
    const failure = new Error("cache failed");
    mockedPrepareCache.mockRejectedValue(failure);

    await expect(seedAppWarmupBundle(createParams())).rejects.toBe(failure);
    expect(stopTelemetry).toHaveBeenCalledWith("error", { message: "cache failed" });
  });
});
