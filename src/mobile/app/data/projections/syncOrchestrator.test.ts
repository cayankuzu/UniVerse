import {
  getRegisteredProjectionSync,
  getRegisteredProjectionSyncEntries,
  noteProjectionSync,
  registerProjectionSync,
  runProjectionSync,
  scheduleProjectionSyncByEntity,
  scheduleProjectionSyncByQueryPrefix,
  scheduleProjectionSync,
  unregisterProjectionSync,
} from "./sync/syncOrchestrator";

async function flushScheduledSync() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("syncOrchestrator", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getRegisteredProjectionSyncEntries().forEach(([screenKey]) => {
      unregisterProjectionSync(screenKey);
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    getRegisteredProjectionSyncEntries().forEach(([screenKey]) => {
      unregisterProjectionSync(screenKey);
    });
  });

  it("runs a scheduled sync and records lastSyncedAt", async () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    registerProjectionSync("screen:key", {
      entity: "home-feed",
      freshnessSlaMs: 1_000,
      prefetchPolicy: "none",
      queryKey: ["screen", "home"],
      sync,
    });

    scheduleProjectionSync("screen:key", 20);
    jest.advanceTimersByTime(20);
    await flushScheduledSync();

    expect(sync).toHaveBeenCalledTimes(1);
    expect(getRegisteredProjectionSync("screen:key")?.lastSyncedAt).toBeGreaterThan(0);
  });

  it("skips scheduling while a projection is still fresh", () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    registerProjectionSync("screen:key", {
      entity: "home-feed",
      freshnessSlaMs: 5_000,
      prefetchPolicy: "none",
      queryKey: ["screen", "home"],
      sync,
    });
    noteProjectionSync("screen:key", Date.now());

    scheduleProjectionSync("screen:key", 20);
    jest.advanceTimersByTime(20);

    expect(sync).not.toHaveBeenCalled();
  });

  it("seeds lastSyncedAt from cached projection state", () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    registerProjectionSync("screen:key", {
      entity: "home-feed",
      freshnessSlaMs: 5_000,
      initialLastSyncedAt: 1_234,
      prefetchPolicy: "none",
      queryKey: ["screen", "home"],
      sync,
    });

    expect(getRegisteredProjectionSync("screen:key")?.lastSyncedAt).toBe(1_234);
  });

  it("runs a scheduled sync immediately when the projection is marked stale", async () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    registerProjectionSync("screen:key", {
      entity: "home-feed",
      freshnessSlaMs: 5_000,
      isStale: () => true,
      prefetchPolicy: "none",
      queryKey: ["screen", "home"],
      sync,
    });
    noteProjectionSync("screen:key", Date.now());

    scheduleProjectionSync("screen:key", 20);
    jest.advanceTimersByTime(20);
    await flushScheduledSync();

    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending scheduled sync when the same screen sync runs manually first", async () => {
    const sync = jest.fn().mockResolvedValue(undefined);
    registerProjectionSync("screen:key", {
      entity: "home-feed",
      freshnessSlaMs: 0,
      prefetchPolicy: "none",
      queryKey: ["screen", "home"],
      sync,
    });

    scheduleProjectionSync("screen:key", 20);
    await runProjectionSync("screen:key");
    jest.advanceTimersByTime(20);
    await flushScheduledSync();

    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("schedules only matching entities", async () => {
    const homeSync = jest.fn().mockResolvedValue(undefined);
    const searchSync = jest.fn().mockResolvedValue(undefined);
    registerProjectionSync("screen:home", {
      entity: "home-feed",
      freshnessSlaMs: 0,
      prefetchPolicy: "none",
      queryKey: ["screen", "home", "viewer"],
      sync: homeSync,
    });
    registerProjectionSync("screen:search", {
      entity: "search-events",
      freshnessSlaMs: 0,
      prefetchPolicy: "none",
      queryKey: ["screen", "search", "events", "viewer"],
      sync: searchSync,
    });

    scheduleProjectionSyncByEntity("search-events", 10);
    jest.advanceTimersByTime(10);
    await flushScheduledSync();

    expect(homeSync).not.toHaveBeenCalled();
    expect(searchSync).toHaveBeenCalledTimes(1);
  });

  it("schedules only matching query prefixes", async () => {
    const firstSync = jest.fn().mockResolvedValue(undefined);
    const secondSync = jest.fn().mockResolvedValue(undefined);
    registerProjectionSync("screen:one", {
      entity: "profile-events",
      freshnessSlaMs: 0,
      prefetchPolicy: "none",
      queryKey: ["screen", "profile-content", "alice", "events", "viewer"],
      sync: firstSync,
    });
    registerProjectionSync("screen:two", {
      entity: "profile-albums",
      freshnessSlaMs: 0,
      prefetchPolicy: "none",
      queryKey: ["screen", "profile-content", "alice", "album", "viewer"],
      sync: secondSync,
    });

    scheduleProjectionSyncByQueryPrefix(["screen", "profile-content", "alice", "events"], 10);
    jest.advanceTimersByTime(10);
    await flushScheduledSync();

    expect(firstSync).toHaveBeenCalledTimes(1);
    expect(secondSync).not.toHaveBeenCalled();
  });
});
