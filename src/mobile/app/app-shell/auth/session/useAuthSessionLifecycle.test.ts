import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AUTH_STORAGE_VERSION } from "./authContext.shared";
import { createSession } from "./useAuthSessionLifecycle.test.helpers";
jest.setTimeout(15_000);
const mockConfirmEmailForTesting = jest.fn();
const mockGetSession = jest.fn();
const mockHardSignOut = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockRefreshSession = jest.fn();
const mockRpc = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockQueryClientClear = jest.fn();
const mockDebugLog = jest.fn();
const mockDebugWarn = jest.fn();
const mockLogAuthSessionError = jest.fn();

jest.mock("../../../platform/config/runtime", () => ({
  DEMO_MODE_ENABLED: false,
}));

jest.mock("../../../data/auth", () => ({
  AuthAPI: {
    confirmEmailForTesting: (...args: unknown[]) => mockConfirmEmailForTesting(...args),
    deleteAccount: jest.fn(),
  },
}));

jest.mock("../../../data/query/queryClient", () => ({
  queryClient: {
    clear: (...args: unknown[]) => mockQueryClientClear(...args),
  },
}));

jest.mock("../../../data/notifications", () => ({
  bestEffortUnregisterStoredPushToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../platform/logging/logger", () => ({
  debugLog: (...args: unknown[]) => mockDebugLog(...args),
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
}));

jest.mock("../../../platform/security/authSessionErrors", () => {
  const actual = jest.requireActual("../../../platform/security/authSessionErrors");
  return {
    ...actual,
    logAuthSessionError: (...args: unknown[]) => mockLogAuthSessionError(...args),
  };
});

jest.mock("../../../data/security/authSessionBoundary", () => ({
  hardSignOut: (...args: unknown[]) => mockHardSignOut(...args),
}));

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
  },
}));

function renderLifecycle(params: any) {
  const { useAuthSessionLifecycle } = require("./useAuthSessionLifecycle");
  return renderHook(() => useAuthSessionLifecycle({ setAuthBootState: jest.fn(), ...params }));
}

describe("useAuthSessionLifecycle", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockConfirmEmailForTesting.mockReset();
    mockGetSession.mockReset();
    mockHardSignOut.mockReset();
    mockOnAuthStateChange.mockReset();
    mockRefreshSession.mockReset();
    mockRpc.mockReset();
    mockSignInWithPassword.mockReset();
    mockQueryClientClear.mockReset();
    mockDebugLog.mockReset();
    mockDebugWarn.mockReset();
    mockLogAuthSessionError.mockReset();

    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error("refresh not expected"),
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    jest.spyOn(AsyncStorage, "getItem").mockImplementation(async (key: string) => {
      if (key === "UNiETAS_auth_storage_version") return AUTH_STORAGE_VERSION;
      return null;
    });
    jest.spyOn(AsyncStorage, "multiSet").mockResolvedValue();
    jest.spyOn(AsyncStorage, "multiRemove").mockResolvedValue();
    jest.spyOn(AsyncStorage, "setItem").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rolls auth state back when profile hydration fails after sign in", async () => {
    const setAccountType = jest.fn();
    const setBlockedUsers = jest.fn();
    const setIsDemoMode = jest.fn();
    const setIsLoading = jest.fn();
    const setIsLoggedIn = jest.fn();
    const setIsPrivateAccountState = jest.fn();
    const setPendingVerification = jest.fn();
    const setUserData = jest.fn();
    const session = createSession();

    mockSignInWithPassword.mockResolvedValue({
      data: { session },
      error: null,
    });

    const { result } = renderLifecycle({
      accountType: "student",
      activeHydrationKeyRef: { current: "" },
      activeHydrationPromiseRef: { current: null },
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      fetchProfile: jest.fn().mockRejectedValue(new Error("Profil bulunamadı")),
      hydratedSessionKey: { current: "" },
      isDemoRef: { current: false },
      isLoading: false,
      refreshBlocked: jest.fn().mockResolvedValue(undefined),
      setAccountType,
      setBlockedUsers,
      setIsDemoMode,
      setIsLoading,
      setIsLoggedIn,
      setIsPrivateAccountState,
      setPendingVerification,
      setUserData,
      suppressSignedOutRef: { current: false },
    });

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled();
    });
    setAccountType.mockClear();
    setBlockedUsers.mockClear();
    setIsDemoMode.mockClear();
    setIsLoading.mockClear();
    setIsLoggedIn.mockClear();
    setIsPrivateAccountState.mockClear();
    setPendingVerification.mockClear();
    setUserData.mockClear();
    mockHardSignOut.mockClear();
    mockQueryClientClear.mockClear();

    await act(async () => {
      await expect(result.current.login("alice@example.com", "secret")).rejects.toThrow(
        "Profil bulunamadı",
      );
    });

    expect(mockHardSignOut).toHaveBeenCalledWith("sign-out");
    expect(setIsLoggedIn).toHaveBeenNthCalledWith(1, true);
    expect(setIsLoggedIn).toHaveBeenLastCalledWith(false);
    expect(mockQueryClientClear).toHaveBeenCalledTimes(1);
  });

  it("continues session hydration in the background after a hydrate timeout", async () => {
    jest.useFakeTimers();
    const session = createSession();
    const fetchProfile = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 13_000);
          }),
      )
      .mockResolvedValueOnce(undefined);

    mockGetSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const { unmount } = renderLifecycle({
      accountType: "student",
      activeHydrationKeyRef: { current: "" },
      activeHydrationPromiseRef: { current: null },
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      fetchProfile,
      hydratedSessionKey: { current: "" },
      isDemoRef: { current: false },
      isLoading: false,
      refreshBlocked: jest.fn().mockResolvedValue(undefined),
      setAccountType: jest.fn(),
      setBlockedUsers: jest.fn(),
      setIsDemoMode: jest.fn(),
      setIsLoading: jest.fn(),
      setIsLoggedIn: jest.fn(),
      setIsPrivateAccountState: jest.fn(),
      setPendingVerification: jest.fn(),
      setUserData: jest.fn(),
      suppressSignedOutRef: { current: false },
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(12_000);
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(fetchProfile).toHaveBeenCalledTimes(2);
    expect(mockDebugWarn).not.toHaveBeenCalledWith(
      "AUTH",
      "session-hydration-failed-after-auth-event",
      expect.anything(),
    );
    expect(mockDebugWarn).not.toHaveBeenCalledWith(
      "AUTH",
      "session-profile-hydration-failed",
      expect.anything(),
    );
    unmount();
    jest.useRealTimers();
  });

  it("recovers login when sign-in times out after the session is already persisted", async () => {
    jest.useFakeTimers();
    const session = createSession();
    const fetchProfile = jest.fn().mockResolvedValue(undefined);

    mockGetSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })
      .mockResolvedValue({
        data: { session },
        error: null,
      });
    mockSignInWithPassword.mockImplementation(() => new Promise(() => undefined));

    const { result, unmount } = renderLifecycle({
      accountType: "student",
      activeHydrationKeyRef: { current: "" },
      activeHydrationPromiseRef: { current: null },
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      fetchProfile,
      hydratedSessionKey: { current: "" },
      isDemoRef: { current: false },
      isLoading: false,
      refreshBlocked: jest.fn().mockResolvedValue(undefined),
      setAccountType: jest.fn(),
      setBlockedUsers: jest.fn(),
      setIsDemoMode: jest.fn(),
      setIsLoading: jest.fn(),
      setIsLoggedIn: jest.fn(),
      setIsPrivateAccountState: jest.fn(),
      setPendingVerification: jest.fn(),
      setUserData: jest.fn(),
      suppressSignedOutRef: { current: false },
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const loginPromise = result.current.login("alice@example.com", "secret");

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    await expect(loginPromise).resolves.toBeUndefined();
    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(mockHardSignOut).not.toHaveBeenCalled();

    unmount();
    jest.useRealTimers();
  });

  it("seeds persisted auth state before bootstrap loading finishes", async () => {
    jest.useFakeTimers();
    const session = createSession();
    const fetchProfile = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 5_000);
        }),
    );
    const setIsLoading = jest.fn();
    const setIsLoggedIn = jest.fn();
    const setUserData = jest.fn();

    mockGetSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    renderLifecycle({
      accountType: "student",
      activeHydrationKeyRef: { current: "" },
      activeHydrationPromiseRef: { current: null },
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      fetchProfile,
      hydratedSessionKey: { current: "" },
      isDemoRef: { current: false },
      isLoading: false,
      refreshBlocked: jest.fn().mockResolvedValue(undefined),
      setAccountType: jest.fn(),
      setBlockedUsers: jest.fn(),
      setIsDemoMode: jest.fn(),
      setIsLoading,
      setIsLoggedIn,
      setIsPrivateAccountState: jest.fn(),
      setPendingVerification: jest.fn(),
      setUserData,
      suppressSignedOutRef: { current: false },
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setIsLoading).toHaveBeenNthCalledWith(1, true);
    expect(setIsLoggedIn).toHaveBeenCalledWith(true);
    expect(setUserData).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alice@example.com",
        username: "alice",
      }),
    );
    expect(fetchProfile).not.toHaveBeenCalled();
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
    expect(setIsLoggedIn.mock.invocationCallOrder[0]).toBeLessThan(
      setIsLoading.mock.invocationCallOrder[1],
    );

    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(fetchProfile).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("logs email confirmation bypass failures without changing the login error", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "email_not_confirmed" },
    });
    mockConfirmEmailForTesting.mockRejectedValue(new Error("bypass failed"));

    const { result } = renderLifecycle({
      accountType: "student",
      activeHydrationKeyRef: { current: "" },
      activeHydrationPromiseRef: { current: null },
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      fetchProfile: jest.fn().mockResolvedValue(undefined),
      hydratedSessionKey: { current: "" },
      isDemoRef: { current: false },
      isLoading: false,
      refreshBlocked: jest.fn().mockResolvedValue(undefined),
      setAccountType: jest.fn(),
      setBlockedUsers: jest.fn(),
      setIsDemoMode: jest.fn(),
      setIsLoading: jest.fn(),
      setIsLoggedIn: jest.fn(),
      setIsPrivateAccountState: jest.fn(),
      setPendingVerification: jest.fn(),
      setUserData: jest.fn(),
      suppressSignedOutRef: { current: false },
    });

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled();
    });

    await act(async () => {
      await expect(result.current.login("alice@example.com", "secret")).rejects.toThrow(
        "email_not_confirmed",
      );
    });

    expect(mockLogAuthSessionError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        code: "auth-login-email-confirm-bypass-failed",
        operation: "login-email-confirm-bypass",
      }),
    );
  });

  it("logs sign-out cleanup failures while preserving auth rollback after login hydration errors", async () => {
    const setIsLoggedIn = jest.fn();
    const session = createSession();

    mockSignInWithPassword.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockHardSignOut.mockRejectedValue(new Error("cleanup failed"));

    const { result } = renderLifecycle({
      accountType: "student",
      activeHydrationKeyRef: { current: "" },
      activeHydrationPromiseRef: { current: null },
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      fetchProfile: jest.fn().mockRejectedValue(new Error("Profil bulunamadı")),
      hydratedSessionKey: { current: "" },
      isDemoRef: { current: false },
      isLoading: false,
      refreshBlocked: jest.fn().mockResolvedValue(undefined),
      setAccountType: jest.fn(),
      setBlockedUsers: jest.fn(),
      setIsDemoMode: jest.fn(),
      setIsLoading: jest.fn(),
      setIsLoggedIn,
      setIsPrivateAccountState: jest.fn(),
      setPendingVerification: jest.fn(),
      setUserData: jest.fn(),
      suppressSignedOutRef: { current: false },
    });

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled();
    });
    setIsLoggedIn.mockClear();
    mockLogAuthSessionError.mockClear();

    await act(async () => {
      await expect(result.current.login("alice@example.com", "secret")).rejects.toThrow(
        "Profil bulunamadı",
      );
    });

    expect(setIsLoggedIn).toHaveBeenNthCalledWith(1, true);
    expect(setIsLoggedIn).toHaveBeenLastCalledWith(false);
    expect(mockLogAuthSessionError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        code: "auth-login-cleanup-signout-failed",
        operation: "login-cleanup-signout",
      }),
    );
  });
});
