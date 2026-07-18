import { createLogoutHandler } from "./useAuthSessionLifecycle.actions";

const mockBestEffortUnregisterStoredPushToken = jest.fn();
const mockClearPersistedNavigationState = jest.fn();

jest.mock("../../../data/notifications", () => ({
  bestEffortUnregisterStoredPushToken: (...args: unknown[]) =>
    mockBestEffortUnregisterStoredPushToken(...args),
}));

jest.mock("../../navigation/navigationStatePersistence", () => ({
  clearPersistedNavigationState: (...args: unknown[]) => mockClearPersistedNavigationState(...args),
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
  });

  it("does not block logout completion on push token unregister", async () => {
    const deferredPushCleanup = createDeferred<void>();
    const clearAuthState = jest.fn();
    const logout = createLogoutHandler({
      clearAuthState,
      clearDemoStorage: jest.fn().mockResolvedValue(undefined),
      isDemoRef: { current: false },
      signOut: jest.fn().mockResolvedValue(undefined),
      suppressSignedOutRef: { current: false },
    });

    mockBestEffortUnregisterStoredPushToken.mockReturnValue(deferredPushCleanup.promise);

    await expect(logout()).resolves.toBeUndefined();

    expect(mockClearPersistedNavigationState).toHaveBeenCalledTimes(1);
    expect(clearAuthState).toHaveBeenCalledTimes(1);
    expect(mockBestEffortUnregisterStoredPushToken).toHaveBeenCalledTimes(1);

    deferredPushCleanup.resolve();
    await deferredPushCleanup.promise;
  });
});
