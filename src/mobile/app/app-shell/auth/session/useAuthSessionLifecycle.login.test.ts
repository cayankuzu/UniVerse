import { createSession } from "./useAuthSessionLifecycle.test.helpers";

const mockHardSignOut = jest.fn();
const mockSignInWithPassword = jest.fn();

jest.mock("../../../platform/config/runtime", () => ({
  ...jest.requireActual("../../../platform/config/runtime"),
  DEMO_MODE_ENABLED: false,
}));
jest.mock("../../../data/auth", () => ({
  AuthAPI: { confirmEmailForTesting: jest.fn() },
}));
jest.mock("../../../data/query/queryClient", () => ({
  queryClient: { clear: jest.fn() },
}));
jest.mock("../../../data/security/authSessionBoundary", () => ({
  hardSignOut: (...args: unknown[]) => mockHardSignOut(...args),
}));
jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
  },
}));

describe("createLoginHandler", () => {
  beforeEach(() => {
    mockHardSignOut.mockReset();
    mockSignInWithPassword.mockReset();
  });

  it("keeps a valid session when the first profile request has a network failure", async () => {
    const session = createSession();
    const clearAuthState = jest.fn();
    const releaseSignedOutSuppression = jest.fn();
    const startSessionHydrationInBackground = jest.fn();
    const suppressSignedOutRef = { current: false };
    mockSignInWithPassword.mockResolvedValue({ data: { session }, error: null });

    const { createLoginHandler } =
      require("./useAuthSessionLifecycle.login") as typeof import("./useAuthSessionLifecycle.login");
    const login = createLoginHandler({
      applyDemoState: jest.fn(),
      clearAuthState,
      recoverAndHydrateSession: jest.fn().mockRejectedValue(new Error("network request failed")),
      releaseSignedOutSuppression,
      setIsLoading: jest.fn(),
      startSessionHydrationInBackground,
      suppressSignedOutRef,
    });

    await expect(login("alice@example.com", "secret")).resolves.toBeUndefined();

    expect(startSessionHydrationInBackground).toHaveBeenCalledWith(
      session,
      "login-profile-sync-retry",
    );
    expect(releaseSignedOutSuppression).toHaveBeenCalledTimes(1);
    expect(clearAuthState).not.toHaveBeenCalled();
    expect(mockHardSignOut).not.toHaveBeenCalled();
  });
});
