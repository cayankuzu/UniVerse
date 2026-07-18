const mockLogAuthSessionError = jest.fn();

jest.mock("../security/authSessionErrors", () => ({
  logAuthSessionError: (...args: unknown[]) => mockLogAuthSessionError(...args),
}));

describe("authStorage", () => {
  beforeEach(async () => {
    jest.resetModules();
    mockLogAuthSessionError.mockReset();
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.clear();
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.__store.clear();
    secureStore.deleteItemAsync.mockClear();
    secureStore.getItemAsync.mockClear();
    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.isAvailableAsync.mockClear();
    secureStore.setItemAsync.mockClear();
  });

  it("stores auth values in SecureStore when available", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const secureStore = jest.requireMock("expo-secure-store");
    const { supabaseAuthStorage } = require("./authStorage");

    await supabaseAuthStorage.setItem("sb-test-auth", "token-value");

    expect(secureStore.setItemAsync).toHaveBeenCalled();
    expect(await AsyncStorage.getItem("sb-test-auth")).toBeNull();
    await expect(supabaseAuthStorage.getItem("sb-test-auth")).resolves.toBe("token-value");
  });

  it("falls back to AsyncStorage when SecureStore is unavailable", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.isAvailableAsync.mockResolvedValue(false);
    const { supabaseAuthStorage } = require("./authStorage");

    await supabaseAuthStorage.setItem("sb-fallback-auth", "token-value");

    expect(await AsyncStorage.getItem("sb-fallback-auth")).toBe("token-value");
  });

  it("logs SecureStore availability probe failures before falling back to AsyncStorage", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.isAvailableAsync.mockRejectedValueOnce(new Error("secure-store-down"));
    const { supabaseAuthStorage } = require("./authStorage");

    await supabaseAuthStorage.setItem("sb-probe-auth", "token-value");

    expect(await AsyncStorage.getItem("sb-probe-auth")).toBe("token-value");
    expect(mockLogAuthSessionError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        code: "auth-storage-secure-store-availability-failed",
        operation: "secure-store-availability",
      }),
    );
  });

  it("logs auth-storage-read-fallback exactly once across multiple SecureStore failures", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.getItemAsync.mockRejectedValue(new Error("device-locked"));
    await AsyncStorage.setItem("sb-breaker-auth", "fallback-value");
    const { supabaseAuthStorage } = require("./authStorage");

    // Multiple reads — all fail in SecureStore, fall back to AsyncStorage
    await supabaseAuthStorage.getItem("sb-breaker-auth");
    await supabaseAuthStorage.getItem("sb-breaker-auth");
    await supabaseAuthStorage.getItem("sb-breaker-auth");
    await supabaseAuthStorage.getItem("sb-breaker-auth");
    await supabaseAuthStorage.getItem("sb-breaker-auth");

    const fallbackCalls = mockLogAuthSessionError.mock.calls.filter(
      (call: unknown[]) => (call[1] as { code?: string })?.code === "auth-storage-read-fallback",
    );
    expect(fallbackCalls.length).toBe(1);

    // All reads still return the AsyncStorage value
    await expect(supabaseAuthStorage.getItem("sb-breaker-auth")).resolves.toBe("fallback-value");
  });

  it("resets circuit breaker after a successful SecureStore write", async () => {
    const secureStore = jest.requireMock("expo-secure-store");
    secureStore.getItemAsync.mockRejectedValue(new Error("device-locked"));
    const { supabaseAuthStorage } = require("./authStorage");

    // Trip the circuit breaker
    await supabaseAuthStorage.getItem("sb-reset-auth");
    await supabaseAuthStorage.getItem("sb-reset-auth");
    await supabaseAuthStorage.getItem("sb-reset-auth");

    // Now SecureStore recovers
    secureStore.getItemAsync.mockResolvedValue(null);
    secureStore.setItemAsync.mockResolvedValue(undefined);
    await supabaseAuthStorage.setItem("sb-reset-auth", "new-value");

    // Should be able to read from SecureStore again
    secureStore.getItemAsync.mockResolvedValue("new-value");
    await expect(supabaseAuthStorage.getItem("sb-reset-auth")).resolves.toBe("new-value");
  });

  it("logs malformed tracked-key registry payloads and continues writing auth values", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("supabase-auth:secure-keys", "{invalid-json");
    const { supabaseAuthStorage } = require("./authStorage");

    await supabaseAuthStorage.setItem("sb-registry-auth", "token-value");

    expect(mockLogAuthSessionError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        code: "auth-storage-registry-read-failed",
        operation: "read-tracked-keys",
      }),
    );
  });
});
