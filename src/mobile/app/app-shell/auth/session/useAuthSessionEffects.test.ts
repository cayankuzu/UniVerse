import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AUTH_STORAGE_VERSION } from "./authContext.shared";

const mockGetActiveOrPersistedSession = jest.fn();
const mockGetPersistedAuthBootstrapSnapshot = jest.fn();
const mockHardSignOut = jest.fn();
const mockLogError = jest.fn();
const mockPersistAuthSession = jest.fn();
const mockSupabaseOnAuthStateChange = jest.fn();

let authStateChangeHandler: ((event: string, session: Session | null) => void) | null = null;

jest.mock("../../../platform/config/runtime", () => ({
  DEMO_MODE_ENABLED: false,
}));

jest.mock("../../../platform/logging/logger", () => ({
  debugWarn: () => undefined,
}));

jest.mock("../../../platform/observability", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockSupabaseOnAuthStateChange(...args),
    },
  },
}));

jest.mock("../../../data/security/authSessionBoundary", () => ({
  hardSignOut: (...args: unknown[]) => mockHardSignOut(...args),
}));

jest.mock("./authSessionSupport", () => ({
  getActiveOrPersistedSession: (...args: unknown[]) => mockGetActiveOrPersistedSession(...args),
  getPersistedAuthBootstrapSnapshot: (...args: unknown[]) =>
    mockGetPersistedAuthBootstrapSnapshot(...args),
  persistAuthSession: (...args: unknown[]) => mockPersistAuthSession(...args),
}));

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

function createPersistedSnapshot() {
  return {
    accountType: "student" as const,
    isPrivateAccount: false,
    userData: {
      categories: [],
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

function flushMicrotasks() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  authStateChangeHandler = null;
  mockGetActiveOrPersistedSession.mockReset();
  mockGetPersistedAuthBootstrapSnapshot.mockReset();
  mockHardSignOut.mockReset();
  mockHardSignOut.mockResolvedValue(undefined);
  mockLogError.mockReset();
  mockPersistAuthSession.mockReset();
  mockSupabaseOnAuthStateChange.mockReset();
  mockSupabaseOnAuthStateChange.mockImplementation(
    (handler: (event: string, session: Session | null) => void) => {
      authStateChangeHandler = handler;
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    },
  );
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useAuthBootstrapInit", () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.spyOn(AsyncStorage, "getItem").mockImplementation(async (key: string) => {
      if (key === "UNiETAS_auth_storage_version") {
        return AUTH_STORAGE_VERSION;
      }
      return null;
    });
    jest.spyOn(AsyncStorage, "setItem").mockResolvedValue();
  });

  it("resolves a signed-out cold launch without seeding authenticated state", async () => {
    const clearAuthState = jest.fn();
    const seedAuthStateFromSnapshot = jest.fn();
    const setAuthBootState = jest.fn();
    const setIsLoading = jest.fn();

    mockGetPersistedAuthBootstrapSnapshot.mockResolvedValue(null);
    mockGetActiveOrPersistedSession.mockResolvedValue(null);

    const { useAuthBootstrapInit } = require("./useAuthSessionEffects");
    renderHook(() =>
      useAuthBootstrapInit({
        applyDemoState: jest.fn(),
        clearAuthState,
        clearDemoStorage: jest.fn().mockResolvedValue(undefined),
        getPersistedAuthBootstrapSnapshot: mockGetPersistedAuthBootstrapSnapshot,
        isDemoRef: { current: false },
        seedAuthStateFromSnapshot,
        setAuthBootState,
        setIsLoading,
        startSessionHydrationInBackground: jest.fn(),
      }),
    );

    await waitFor(() => {
      expect(clearAuthState).toHaveBeenCalledWith({ keepLoading: true });
    });

    expect(setAuthBootState).toHaveBeenNthCalledWith(1, "booting");
    expect(seedAuthStateFromSnapshot).not.toHaveBeenCalled();
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
  });

  it("seeds a persisted snapshot before a slow session restore resolves", async () => {
    const session = createSession();
    const persistedSnapshot = createPersistedSnapshot();
    const clearAuthState = jest.fn();
    const seedAuthStateFromSnapshot = jest.fn();
    const setAuthBootState = jest.fn();
    const setIsLoading = jest.fn();
    const startSessionHydrationInBackground = jest.fn();
    let resolveSession: ((value: Session | null) => void) | null = null;

    mockGetPersistedAuthBootstrapSnapshot.mockResolvedValue(persistedSnapshot);
    mockGetActiveOrPersistedSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );

    const { useAuthBootstrapInit } = require("./useAuthSessionEffects");
    renderHook(() =>
      useAuthBootstrapInit({
        applyDemoState: jest.fn(),
        clearAuthState,
        clearDemoStorage: jest.fn().mockResolvedValue(undefined),
        getPersistedAuthBootstrapSnapshot: mockGetPersistedAuthBootstrapSnapshot,
        isDemoRef: { current: false },
        seedAuthStateFromSnapshot,
        setAuthBootState,
        setIsLoading,
        startSessionHydrationInBackground,
      }),
    );

    await flushMicrotasks();
    expect(seedAuthStateFromSnapshot).toHaveBeenCalledWith(persistedSnapshot);
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
    expect(startSessionHydrationInBackground).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 1_600);
      });
    });

    expect(setIsLoading).toHaveBeenLastCalledWith(false);
    expect(startSessionHydrationInBackground).not.toHaveBeenCalled();
    expect(clearAuthState).not.toHaveBeenCalled();

    await act(async () => {
      resolveSession?.(session);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(startSessionHydrationInBackground).toHaveBeenCalledWith(session, "INITIAL_SESSION");
  });
});

describe("useAuthSessionSubscription", () => {
  it("persists refreshed sessions without clearing the signed-in shell", async () => {
    const session = createSession();
    const clearAuthState = jest.fn();
    const recoverAndHydrateSession = jest.fn();
    const startSessionHydrationInBackground = jest.fn();

    const { useAuthSessionSubscription } = require("./useAuthSessionEffects");
    renderHook(() =>
      useAuthSessionSubscription({
        clearAuthState,
        confirmPersistedSession: jest.fn().mockResolvedValue(null),
        isDemoRef: { current: false },
        lastSeededSessionAtRef: { current: 0 },
        recoverAndHydrateSession,
        startSessionHydrationInBackground,
        suppressSignedOutRef: { current: false },
      }),
    );

    await act(async () => {
      authStateChangeHandler?.("TOKEN_REFRESHED", session);
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPersistAuthSession).toHaveBeenCalledWith(session);
    expect(recoverAndHydrateSession).not.toHaveBeenCalled();
    expect(startSessionHydrationInBackground).not.toHaveBeenCalled();
    expect(clearAuthState).not.toHaveBeenCalled();
  });

  it("suppresses the SIGNED_OUT event emitted by an intentional logout boundary", async () => {
    const clearAuthState = jest.fn();
    const confirmPersistedSession = jest.fn().mockResolvedValue(null);
    const suppressSignedOutRef = { current: true };

    const { useAuthSessionSubscription } = require("./useAuthSessionEffects");
    renderHook(() =>
      useAuthSessionSubscription({
        clearAuthState,
        confirmPersistedSession,
        isDemoRef: { current: false },
        lastSeededSessionAtRef: { current: 0 },
        recoverAndHydrateSession: jest.fn(),
        startSessionHydrationInBackground: jest.fn(),
        suppressSignedOutRef,
      }),
    );

    await act(async () => {
      authStateChangeHandler?.("SIGNED_OUT", null);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(confirmPersistedSession).not.toHaveBeenCalled();
    expect(mockHardSignOut).not.toHaveBeenCalled();
    expect(clearAuthState).not.toHaveBeenCalled();
  });

  it("uses the proof-preserving default boundary for an external SIGNED_OUT event", async () => {
    const clearAuthState = jest.fn();

    const { useAuthSessionSubscription } = require("./useAuthSessionEffects");
    renderHook(() =>
      useAuthSessionSubscription({
        clearAuthState,
        confirmPersistedSession: jest.fn().mockResolvedValue(null),
        isDemoRef: { current: false },
        lastSeededSessionAtRef: { current: 0 },
        recoverAndHydrateSession: jest.fn(),
        startSessionHydrationInBackground: jest.fn(),
        suppressSignedOutRef: { current: false },
      }),
    );

    await act(async () => {
      authStateChangeHandler?.("SIGNED_OUT", null);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });

    expect(mockHardSignOut).toHaveBeenCalledWith("sign-out");
    expect(clearAuthState).toHaveBeenCalledTimes(1);
  });
});
