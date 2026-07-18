describe("secure persisted text storage", () => {
  beforeEach(async () => {
    jest.resetModules();
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.clear();
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.__store.clear();
    secureStore.deleteItemAsync.mockClear();
    secureStore.getItemAsync.mockClear();
    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.setItemAsync.mockClear();
  });

  it("migrates an insecure test value when secure metadata is malformed", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.__store.set("app-secure.cache-key.meta", "{broken-json");
    await AsyncStorage.setItem("cache-key", "legacy-value");
    const { secureTextStorage } = require("./securePersist") as typeof import("./securePersist");

    await expect(secureTextStorage.getItem("cache-key")).resolves.toBe("legacy-value");
    await expect(AsyncStorage.getItem("cache-key")).resolves.toBeNull();
  });

  it("removes an incomplete secure chunk set", async () => {
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.__store.set("app-secure.cache-key.meta", JSON.stringify({ chunkCount: 2 }));
    secureStore.__store.set("app-secure.cache-key.0", "first");
    const { secureTextStorage } = require("./securePersist") as typeof import("./securePersist");

    await expect(secureTextStorage.getItem("cache-key")).resolves.toBeNull();
    expect(secureStore.__store.has("app-secure.cache-key.meta")).toBe(false);
  });

  it("deletes surplus chunks when a secure value shrinks", async () => {
    const secureStore = jest.requireMock("expo-secure-store");
    const { secureTextStorage } = require("./securePersist") as typeof import("./securePersist");

    await secureTextStorage.setItem("cache-key", "x".repeat(3_200));
    expect(secureStore.__store.has("app-secure.cache-key.2")).toBe(true);
    await secureTextStorage.setItem("cache-key", "small");

    expect(secureStore.__store.has("app-secure.cache-key.1")).toBe(false);
    expect(secureStore.__store.has("app-secure.cache-key.2")).toBe(false);
    await expect(secureTextStorage.getItem("cache-key")).resolves.toBe("small");
  });
});
