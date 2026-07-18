const mockGetSession = jest.fn();
const mockLogAuthSessionError = jest.fn();

jest.mock("../../../platform/security/authSessionErrors", () => ({
  logAuthSessionError: (...args: unknown[]) => mockLogAuthSessionError(...args),
}));

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: jest.fn(),
    },
  },
}));

describe("useAuthSessionLifecycle.helpers", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockLogAuthSessionError.mockReset();
  });

  it("logs persisted-session confirmation failures and returns null", async () => {
    mockGetSession.mockRejectedValue(new Error("session-read-failed"));
    const { confirmPersistedSession } = require("./useAuthSessionLifecycle.helpers");

    await expect(confirmPersistedSession()).resolves.toBeNull();
    expect(mockLogAuthSessionError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        code: "auth-session-confirm-failed",
        operation: "confirm-persisted-session",
      }),
    );
  });
});
