import { createDeleteAccountHandler, createLogoutHandler } from "./useAuthSessionLifecycle.actions";

const mockBestEffortUnregisterStoredPushToken = jest.fn();
const mockClearPersistedNavigationState = jest.fn();
const mockDeleteAccount = jest.fn();
const mockDebugWarn = jest.fn();
const mockReportRecoverableAuthSessionError = jest.fn();
const mockToRecoverableAuthSessionError = jest.fn();

jest.mock("../../../data/auth", () => ({
  AuthAPI: {
    deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  },
}));

jest.mock("../../../data/notifications", () => ({
  bestEffortUnregisterStoredPushToken: (...args: unknown[]) =>
    mockBestEffortUnregisterStoredPushToken(...args),
}));

jest.mock("../../navigation/navigationStatePersistence", () => ({
  clearPersistedNavigationState: (...args: unknown[]) => mockClearPersistedNavigationState(...args),
}));

jest.mock("../../../platform/logging/logger", () => ({
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
}));

jest.mock("./useAuthSessionLifecycle.errors", () => ({
  reportRecoverableAuthSessionError: (...args: unknown[]) =>
    mockReportRecoverableAuthSessionError(...args),
  toRecoverableAuthSessionError: (...args: unknown[]) => mockToRecoverableAuthSessionError(...args),
}));

function createDeferred<T>() {
  let reject!: (error?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe("createLogoutHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearPersistedNavigationState.mockResolvedValue(undefined);
    mockBestEffortUnregisterStoredPushToken.mockResolvedValue({ status: "cleared" });
    mockDeleteAccount.mockResolvedValue({ success: true });
    mockToRecoverableAuthSessionError.mockImplementation(
      (_error: unknown, _code: string, fallbackMessage: string) => new Error(fallbackMessage),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("waits for confirmed push cleanup before completing logout", async () => {
    const deferredPushCleanup = createDeferred<{ status: "cleared" }>();
    const clearAuthState = jest.fn();
    const signOut = jest.fn().mockResolvedValue(undefined);
    const logout = createLogoutHandler({
      clearAuthState,
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      isDemoRef: { current: false },
      signOut,
      suppressSignedOutRef: { current: false },
    });

    mockBestEffortUnregisterStoredPushToken.mockReturnValue(deferredPushCleanup.promise);

    const logoutPromise = logout();
    await Promise.resolve();
    expect(signOut).not.toHaveBeenCalled();

    deferredPushCleanup.resolve({ status: "cleared" });
    await expect(logoutPromise).resolves.toBeUndefined();

    expect(mockClearPersistedNavigationState).toHaveBeenCalledTimes(1);
    expect(clearAuthState).toHaveBeenCalledTimes(1);
    expect(mockBestEffortUnregisterStoredPushToken).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 3_500 }),
    );
    expect(signOut).toHaveBeenCalledWith();
  });

  it("retains retry state, logs telemetry, and still completes logout after unregister failure", async () => {
    const clearAuthState = jest.fn();
    const signOut = jest.fn().mockResolvedValue(undefined);
    const cleanupError = new Error("network unavailable");
    mockBestEffortUnregisterStoredPushToken.mockResolvedValue({
      error: cleanupError,
      reason: "unregister-failed",
      status: "retained",
    });

    const suppressSignedOutRef = { current: false };
    await createLogoutHandler({
      clearAuthState,
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      isDemoRef: { current: false },
      signOut,
      suppressSignedOutRef,
    })();

    expect(signOut).toHaveBeenCalledWith();
    expect(suppressSignedOutRef.current).toBe(true);
    expect(mockReportRecoverableAuthSessionError).toHaveBeenCalledWith(
      cleanupError,
      "auth-logout-push-unregister-retained",
      expect.any(String),
      "logout-push-unregister",
    );
    expect(mockDebugWarn).toHaveBeenCalledWith("AUTH", "logout-push-unregister-retained", {
      reason: "unregister-failed",
    });
    expect(clearAuthState).toHaveBeenCalledTimes(1);
  });

  it("purges navigation and local auth UI even when hard sign-out cleanup rejects", async () => {
    const cleanupError = new Error("sensitive cleanup failed");
    const clearAuthState = jest.fn();
    const signOut = jest.fn().mockRejectedValue(cleanupError);

    await expect(
      createLogoutHandler({
        clearAuthState,
        clearDemoStorage: jest.fn().mockResolvedValue(undefined),
        isDemoRef: { current: false },
        signOut,
        suppressSignedOutRef: { current: false },
      })(),
    ).rejects.toBe(cleanupError);

    expect(mockClearPersistedNavigationState).toHaveBeenCalledTimes(1);
    expect(clearAuthState).toHaveBeenCalledTimes(1);
  });

  it("attaches demo cleanup rejection handling and still purges navigation and auth UI", async () => {
    const cleanupError = new Error("demo cleanup failed");
    const clearAuthState = jest.fn();

    await expect(
      createLogoutHandler({
        clearAuthState,
        clearDemoStorage: jest.fn().mockRejectedValue(cleanupError),
        isDemoRef: { current: false },
        signOut: jest.fn().mockResolvedValue(undefined),
        suppressSignedOutRef: { current: false },
      })(),
    ).rejects.toBe(cleanupError);

    expect(mockClearPersistedNavigationState).toHaveBeenCalledTimes(1);
    expect(clearAuthState).toHaveBeenCalledTimes(1);
  });

  it("bounds a non-settling unregister request and aborts it before logout", async () => {
    jest.useFakeTimers();
    const clearAuthState = jest.fn();
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockBestEffortUnregisterStoredPushToken.mockReturnValue(new Promise(() => undefined));

    const logoutPromise = createLogoutHandler({
      clearAuthState,
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      isDemoRef: { current: false },
      signOut,
      suppressSignedOutRef: { current: false },
    })();

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(3_500);
    await expect(logoutPromise).resolves.toBeUndefined();

    const options = mockBestEffortUnregisterStoredPushToken.mock.calls[0][0] as {
      signal?: AbortSignal;
      timeoutMs?: number;
    };
    expect(options.timeoutMs).toBe(3_500);
    expect(options.signal?.aborted).toBe(true);
    expect(signOut).toHaveBeenCalledWith();
    expect(clearAuthState).toHaveBeenCalledTimes(1);
  });
});

describe("createDeleteAccountHandler", () => {
  const createParams = () => ({
    clearAuthState: jest.fn(),
    clearDemoStorage: jest.fn().mockResolvedValue(undefined),
    isDemoRef: { current: false },
    logout: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearPersistedNavigationState.mockResolvedValue(undefined);
    mockDeleteAccount.mockResolvedValue({ success: true });
    mockToRecoverableAuthSessionError.mockImplementation(
      (_error: unknown, _code: string, fallbackMessage: string) => new Error(fallbackMessage),
    );
  });

  it("clears push proof after a confirmed account-delete cascade", async () => {
    const params = createParams();

    await createDeleteAccountHandler(params)();

    expect(params.signOut).toHaveBeenCalledWith({ clearPushRegistration: true });
    expect(params.clearAuthState).toHaveBeenCalledTimes(1);
  });

  it("terminally clears auth UI after confirmed deletion when local cleanups reject", async () => {
    const params = createParams();
    const demoCleanupError = new Error("demo cleanup failed");
    const navigationCleanupError = new Error("navigation cleanup failed");
    params.clearDemoStorage.mockRejectedValue(demoCleanupError);
    mockClearPersistedNavigationState.mockRejectedValue(navigationCleanupError);

    await expect(createDeleteAccountHandler(params)()).resolves.toBeUndefined();

    expect(params.clearAuthState).toHaveBeenCalledTimes(1);
    expect(mockReportRecoverableAuthSessionError).toHaveBeenCalledWith(
      demoCleanupError,
      "auth-delete-account-demo-storage-cleanup-failed",
      expect.any(String),
      "delete-account-cleanup",
    );
    expect(mockReportRecoverableAuthSessionError).toHaveBeenCalledWith(
      navigationCleanupError,
      "auth-delete-account-navigation-cleanup-failed",
      expect.any(String),
      "delete-account-cleanup",
    );
  });

  it("keeps the session whenever the delete request fails", async () => {
    const params = createParams();
    mockDeleteAccount.mockRejectedValue(new Error("Unauthorized"));

    await expect(createDeleteAccountHandler(params)()).rejects.toThrow("Hesap silinemedi.");

    expect(params.signOut).not.toHaveBeenCalled();
    expect(params.clearAuthState).not.toHaveBeenCalled();
  });

  it("fails closed when account deletion returns malformed success", async () => {
    const params = createParams();
    mockDeleteAccount.mockResolvedValue({ success: false });

    await expect(createDeleteAccountHandler(params)()).rejects.toThrow("Hesap silinemedi.");

    expect(params.signOut).not.toHaveBeenCalled();
    expect(params.clearAuthState).not.toHaveBeenCalled();
  });

  it("never treats an auth-related delete error as deletion evidence", async () => {
    const params = createParams();
    mockDeleteAccount.mockRejectedValue(new Error("Unauthorized"));

    await expect(createDeleteAccountHandler(params)()).rejects.toThrow("Hesap silinemedi.");

    expect(params.signOut).not.toHaveBeenCalled();
    expect(params.clearAuthState).not.toHaveBeenCalled();
  });
});
