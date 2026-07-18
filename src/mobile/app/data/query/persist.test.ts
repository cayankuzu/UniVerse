jest.mock("../../platform/storage/securePersist", () => ({
  removeSecurePersistedValue: jest.fn(async () => undefined),
  secureTextStorage: {
    getItem: jest.fn(),
    removeItem: jest.fn(async () => undefined),
    setItem: jest.fn(async () => undefined),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { shouldPersistQuery } from "./persist";
import {
  clearPersistedQueryCache,
  QUERY_CACHE_MAX_BYTES,
  QUERY_CACHE_PERSIST_KEY,
  queryCachePersister,
} from "./persist";

const { secureTextStorage, removeSecurePersistedValue } = jest.requireMock(
  "../../platform/storage/securePersist",
) as {
  removeSecurePersistedValue: jest.Mock;
  secureTextStorage: {
    getItem: jest.Mock;
    removeItem: jest.Mock;
    setItem: jest.Mock;
  };
};

function buildQuery(queryKey: unknown[], data?: unknown) {
  return {
    queryKey,
    state: {
      data,
      status: "success",
    },
  } as unknown as Parameters<typeof shouldPersistQuery>[0];
}

describe("shouldPersistQuery", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps lightweight snapshot queries", () => {
    expect(shouldPersistQuery(buildQuery(["badge", "notifications", "viewer"]))).toBe(true);
    expect(shouldPersistQuery(buildQuery(["profile", "me", "viewer"]))).toBe(true);
    expect(shouldPersistQuery(buildQuery(["screen", "profile-overview", "alice", "viewer"]))).toBe(
      true,
    );
    expect(shouldPersistQuery(buildQuery(["screen", "home", "viewer", "scope"]))).toBe(true);
    expect(shouldPersistQuery(buildQuery(["screen", "notifications", "viewer"]))).toBe(true);
    expect(
      shouldPersistQuery(buildQuery(["screen", "profile-content", "alice", "album", "viewer"])),
    ).toBe(true);
    expect(
      shouldPersistQuery(buildQuery(["screen", "relationships", "alice", "followers", "viewer"])),
    ).toBe(true);
    expect(shouldPersistQuery(buildQuery(["screen", "search", "events", "viewer", "scope"]))).toBe(
      true,
    );
    expect(
      shouldPersistQuery(buildQuery(["discovery", "relations", "snapshot", "viewer-id", "alice"])),
    ).toBe(true);
    expect(
      shouldPersistQuery(buildQuery(["social", "relations", "snapshot", "viewer-id", "alice"])),
    ).toBe(true);
  });

  it("persists fast-return screen snapshots used across the app", () => {
    expect(
      shouldPersistQuery(
        buildQuery(["screen", "profile-content", "alice", "album", "viewer"], {
          ids: ["album:1"],
        }),
      ),
    ).toBe(true);
    expect(
      shouldPersistQuery(buildQuery(["screen", "home", "viewer", "scope"], { ids: ["event:1"] })),
    ).toBe(true);
    expect(
      shouldPersistQuery(buildQuery(["screen", "notifications", "viewer"], { ids: ["notif-1"] })),
    ).toBe(true);
    expect(
      shouldPersistQuery(
        buildQuery(["screen", "album-event", "event-1", "viewer"], { ids: ["1"] }),
      ),
    ).toBe(true);
    expect(
      shouldPersistQuery(buildQuery(["screen", "relationships", "alice", "followers", "viewer"])),
    ).toBe(true);
  });

  it("skips heavyweight entity rows on startup restore", () => {
    expect(shouldPersistQuery(buildQuery(["entity", "home-feed", "event:1"]))).toBe(false);
    expect(shouldPersistQuery(buildQuery(["entity", "notifications", "notif-1"]))).toBe(false);
    expect(shouldPersistQuery(buildQuery(["entity", "profile-events", "event-1"]))).toBe(false);
    expect(shouldPersistQuery(buildQuery(["entity", "profile-albums", "album-1"]))).toBe(false);
    expect(shouldPersistQuery(buildQuery(["entity", "search-users", "user-1"]))).toBe(false);
  });

  it("skips non-allowlisted query keys", () => {
    expect(shouldPersistQuery(buildQuery(["entity", "random", "item-1"]))).toBe(false);
    expect(shouldPersistQuery(buildQuery(["unknown", "random", "key"]))).toBe(false);
  });

  it("does not persist pending or errored queries", () => {
    expect(
      shouldPersistQuery({
        queryKey: ["badge", "notifications", "viewer"],
        state: { status: "pending" },
      } as unknown as Parameters<typeof shouldPersistQuery>[0]),
    ).toBe(false);
    expect(
      shouldPersistQuery({
        queryKey: ["profile", "me", "viewer"],
        state: { status: "error" },
      } as unknown as Parameters<typeof shouldPersistQuery>[0]),
    ).toBe(false);
  });

  it("persists a bounded query cache without SecureStore startup chunking", async () => {
    jest.useFakeTimers();
    const persistPromise = queryCachePersister.persistClient({
      buster: "buster",
      clientState: {
        mutations: [],
        queries: [],
      },
      timestamp: 123,
    });
    await jest.advanceTimersByTimeAsync(350);
    await persistPromise;

    await expect(AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY)).resolves.toContain(
      '"buster":"buster"',
    );
    expect(secureTextStorage.setItem).not.toHaveBeenCalled();
    expect(removeSecurePersistedValue).toHaveBeenCalledWith(QUERY_CACHE_PERSIST_KEY);
  });

  it("migrates a persisted client out of legacy secure text storage", async () => {
    secureTextStorage.getItem.mockResolvedValue(
      JSON.stringify({
        buster: "restore-buster",
        cacheState: { queries: [] },
        timestamp: 456,
      }),
    );

    await expect(queryCachePersister.restoreClient()).resolves.toMatchObject({
      buster: "restore-buster",
      timestamp: 456,
    });
    await expect(AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY)).resolves.toContain(
      '"buster":"restore-buster"',
    );
    expect(removeSecurePersistedValue).toHaveBeenCalledWith(QUERY_CACHE_PERSIST_KEY);
  });

  it("drops corrupt persisted query payloads", async () => {
    await AsyncStorage.setItem(QUERY_CACHE_PERSIST_KEY, "{broken-json");

    await expect(queryCachePersister.restoreClient()).resolves.toBeUndefined();
    expect(removeSecurePersistedValue).toHaveBeenCalledWith(QUERY_CACHE_PERSIST_KEY);
  });

  it("restores an already-sanitized cache without rewriting it", async () => {
    const raw = JSON.stringify({
      buster: "restore-buster",
      clientState: { mutations: [], queries: [] },
      timestamp: 789,
    });
    await AsyncStorage.setItem(QUERY_CACHE_PERSIST_KEY, raw);
    const setItemSpy = jest.spyOn(AsyncStorage, "setItem");
    setItemSpy.mockClear();

    await expect(queryCachePersister.restoreClient()).resolves.toMatchObject({
      buster: "restore-buster",
      timestamp: 789,
    });
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("removes sensitive fields from a legacy cache during its single-pass restore", async () => {
    await AsyncStorage.setItem(
      QUERY_CACHE_PERSIST_KEY,
      JSON.stringify({
        buster: "legacy-sensitive",
        clientState: {
          mutations: [],
          queries: [{ state: { data: { email: "private@example.test", username: "alice" } } }],
        },
        timestamp: 790,
      }),
    );

    await expect(queryCachePersister.restoreClient()).resolves.toMatchObject({
      buster: "legacy-sensitive",
    });
    const sanitized = String(await AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY));
    expect(sanitized).toContain('"username":"alice"');
    expect(sanitized).not.toContain("private@example.test");
  });

  it("strips sensitive fields before writing a public snapshot cache", async () => {
    jest.useFakeTimers();
    const persistPromise = queryCachePersister.persistClient({
      buster: "sensitive-buster",
      clientState: {
        mutations: [],
        queries: [
          {
            queryHash: "profile-me",
            queryKey: ["profile", "me", "viewer"],
            state: {
              data: {
                access_token: "must-not-persist",
                email: "private@example.test",
                phone: "+900000000000",
                username: "public-name",
              },
              dataUpdateCount: 1,
              dataUpdatedAt: 123,
              error: null,
              errorUpdateCount: 0,
              errorUpdatedAt: 0,
              fetchFailureCount: 0,
              fetchFailureReason: null,
              fetchMeta: null,
              fetchStatus: "idle",
              isInvalidated: false,
              status: "success",
            },
          },
        ],
      },
      timestamp: 123,
    });
    await jest.advanceTimersByTimeAsync(350);
    await persistPromise;

    const raw = String(await AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY));
    expect(raw).toContain('"username":"public-name"');
    expect(raw).not.toContain("must-not-persist");
    expect(raw).not.toContain("private@example.test");
    expect(raw).not.toContain("+900000000000");
  });

  it("drops oversized restored and pending cache payloads", async () => {
    await AsyncStorage.setItem(QUERY_CACHE_PERSIST_KEY, "x".repeat(QUERY_CACHE_MAX_BYTES + 1));
    await expect(queryCachePersister.restoreClient()).resolves.toBeUndefined();
    await expect(AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY)).resolves.toBeNull();

    jest.useFakeTimers();
    const persistPromise = queryCachePersister.persistClient({
      buster: "x".repeat(QUERY_CACHE_MAX_BYTES + 1),
      clientState: { mutations: [], queries: [] },
      timestamp: 999,
    });
    await jest.advanceTimersByTimeAsync(350);
    await persistPromise;
    await expect(AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY)).resolves.toBeNull();
  });

  it("repairs corrupt legacy secure cache and removes all cache generations", async () => {
    secureTextStorage.getItem.mockResolvedValue("{broken-json");
    await expect(queryCachePersister.restoreClient()).resolves.toBeUndefined();

    await AsyncStorage.setItem(QUERY_CACHE_PERSIST_KEY, "current");
    await AsyncStorage.setItem("ogrencisosyalagi:query-cache", "legacy");
    await clearPersistedQueryCache();

    await expect(AsyncStorage.getItem(QUERY_CACHE_PERSIST_KEY)).resolves.toBeNull();
    await expect(AsyncStorage.getItem("ogrencisosyalagi:query-cache")).resolves.toBeNull();
  });

  it("coalesces duplicate writes and settles a pending flush on removal", async () => {
    jest.useFakeTimers();
    const client = {
      buster: "duplicate-buster",
      clientState: { mutations: [], queries: [] },
      timestamp: 1_000,
    };
    const first = queryCachePersister.persistClient(client);
    await jest.advanceTimersByTimeAsync(350);
    await first;

    const second = queryCachePersister.persistClient(client);
    await jest.advanceTimersByTimeAsync(350);
    await second;

    const pending = queryCachePersister.persistClient({ ...client, timestamp: 1_001 });
    await queryCachePersister.removeClient();
    await expect(pending).resolves.toBeUndefined();
  });
});
