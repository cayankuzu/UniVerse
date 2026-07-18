import type { Session } from "@supabase/supabase-js";

function createSession(): Session {
  return {
    access_token: "token-abcdefghijklmnopqrstuvwxyz",
    expires_at: 1_893_456_000,
    expires_in: 3600,
    refresh_token: "refresh-token",
    token_type: "bearer",
    user: {
      app_metadata: {},
      aud: "authenticated",
      created_at: "2026-03-17T00:00:00.000Z",
      email: "alice@example.com",
      id: "user-1",
      role: "authenticated",
      updated_at: "2026-03-17T00:00:00.000Z",
      user_metadata: {
        accountType: "student",
        email: "alice@example.com",
        name: "Alice",
        username: "alice",
      },
    },
  } as Session;
}

function createSnapshot() {
  return {
    accountType: "student" as const,
    isPrivateAccount: false,
    userData: {
      albums: 0,
      bio: "x".repeat(4_500),
      categories: Array.from({ length: 64 }, (_, index) => `kategori-${index}`),
      coverImage: "",
      email: "alice@example.com",
      events: 0,
      followers: 0,
      following: 0,
      profileImage: "",
      university: "UniVerse",
      username: "alice",
    },
  };
}

describe("authSession", () => {
  beforeEach(async () => {
    jest.resetModules();
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const secureStore = jest.requireMock("expo-secure-store");
    await AsyncStorage.clear();
    secureStore.__store.clear();
    secureStore.deleteItemAsync.mockClear();
    secureStore.getItemAsync.mockClear();
    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.isAvailableAsync.mockClear();
    secureStore.setItemAsync.mockClear();
  });

  it("persists session and large bootstrap snapshot across chunked secure storage", async () => {
    const secureStore = jest.requireMock("expo-secure-store");
    const {
      getPersistedAuthSession,
      getPersistedAuthSnapshot,
      savePersistedAuthSession,
      savePersistedAuthSnapshot,
    } = require("./authSession");

    await savePersistedAuthSession(createSession());
    await savePersistedAuthSnapshot(createSnapshot());

    expect(secureStore.__store.size).toBeGreaterThan(2);
    await expect(getPersistedAuthSession()).resolves.toEqual({
      access_token: "token-abcdefghijklmnopqrstuvwxyz",
      refresh_token: "refresh-token",
    });
    await expect(getPersistedAuthSnapshot()).resolves.toEqual(
      expect.objectContaining({
        accountType: "student",
        isPrivateAccount: false,
      }),
    );
  });

  it("migrates legacy direct SecureStore payloads to chunked secure persistence", async () => {
    const secureStore = jest.requireMock("expo-secure-store");
    const legacyPayload = {
      access_token: "legacy-access-token",
      refresh_token: "legacy-refresh-token",
      snapshot: createSnapshot(),
    };
    secureStore.__store.set("universe.auth.session:v1", JSON.stringify(legacyPayload));
    const { getPersistedAuthSession, getPersistedAuthSnapshot } = require("./authSession");

    await expect(getPersistedAuthSession()).resolves.toEqual({
      access_token: "legacy-access-token",
      refresh_token: "legacy-refresh-token",
    });
    await expect(getPersistedAuthSnapshot()).resolves.toEqual(
      expect.objectContaining({
        accountType: "student",
      }),
    );
    expect(secureStore.__store.has("universe.auth.session:v1")).toBe(false);
    expect(
      Array.from(secureStore.__store.keys()).some((key) =>
        String(key).includes("app-secure.universe.auth.session_x3a_v1"),
      ),
    ).toBe(true);
  });

  it("falls back to AsyncStorage when SecureStore is unavailable", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.isAvailableAsync.mockResolvedValue(false);
    const { getPersistedAuthSession, savePersistedAuthSession } = require("./authSession");

    await savePersistedAuthSession(createSession());

    expect(await AsyncStorage.getItem("universe.auth.session:v1")).toContain("refresh-token");
    await expect(getPersistedAuthSession()).resolves.toEqual({
      access_token: "token-abcdefghijklmnopqrstuvwxyz",
      refresh_token: "refresh-token",
    });
  });

  it("singleflights the secure payload read and serves later bootstrap reads from memory", async () => {
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.__store.set(
      "universe.auth.session:v1",
      JSON.stringify({
        access_token: "legacy-access-token",
        refresh_token: "legacy-refresh-token",
        snapshot: createSnapshot(),
      }),
    );
    secureStore.getItemAsync.mockClear();
    const { getPersistedAuthSession, getPersistedAuthSnapshot } = require("./authSession");
    await Promise.all([getPersistedAuthSession(), getPersistedAuthSnapshot()]);
    const readsAfterConcurrentBootstrap = secureStore.getItemAsync.mock.calls.length;

    expect(readsAfterConcurrentBootstrap).toBeGreaterThan(0);
    await getPersistedAuthSession();
    await getPersistedAuthSnapshot();
    expect(secureStore.getItemAsync).toHaveBeenCalledTimes(readsAfterConcurrentBootstrap);
  });

  it("fails closed and clears malformed persisted auth payloads", async () => {
    const secureStore = jest.requireMock("expo-secure-store");
    const baseKey = "app-secure.universe.auth.session_x3a_v1";
    secureStore.__store.set(`${baseKey}.meta`, JSON.stringify({ chunkCount: 1 }));
    secureStore.__store.set(
      `${baseKey}.0`,
      JSON.stringify({ access_token: "", refresh_token: "" }),
    );
    const {
      clearPersistedAuthSession,
      getPersistedAuthSession,
      savePersistedAuthSession,
    } = require("./authSession");

    await expect(getPersistedAuthSession()).resolves.toBeNull();
    expect(secureStore.__store.has(`${baseKey}.meta`)).toBe(false);

    await savePersistedAuthSession(null);
    await clearPersistedAuthSession();
    await expect(getPersistedAuthSession()).resolves.toBeNull();
  });
});
