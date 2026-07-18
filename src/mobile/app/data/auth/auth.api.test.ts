import { AuthAPI } from "./auth.api";

jest.mock("../../platform/config/runtime", () => ({
  AUTH_VERIFICATION_BYPASS_ENABLED: true,
}));

jest.mock("../../platform/api/core", () => ({
  get: jest.fn(),
  isFunctionUnavailable: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

jest.mock("../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => jest.fn()),
}));

jest.mock("../security/authSessionBoundary", () => ({
  hardSignOut: jest.fn(),
}));

jest.mock("../../platform/supabase", () => ({
  authCallbackUrl: "ogrencisosyalagi://auth/callback",
  supabase: {
    rpc: jest.fn(),
    auth: {
      signUp: jest.fn(),
      updateUser: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

jest.mock("./authProfileSync", () => ({
  applyProfileUpdateInTable: jest.fn(),
}));

jest.mock("./auth.shared", () => ({
  fallbackDeleteOwnAccount: jest.fn(),
  fallbackGetMeFromTable: jest.fn(),
  fallbackRegisterToTable: jest.fn(),
  getErrorMessage: jest.fn((error: unknown) =>
    String((error as { message?: string })?.message || error || ""),
  ),
  isProfileLookupError: jest.fn(() => false),
  isUnauthorizedError: jest.fn(() => false),
  mergeProfiles: jest.fn(),
  normalizeRemoteUserProfile: jest.fn(),
  recoverLocalProfileFromAuthState: jest.fn(),
  recoverSessionForProfileRead: jest.fn(),
}));

const { post, isFunctionUnavailable } = jest.requireMock("../../platform/api/core") as {
  put: jest.Mock;
  post: jest.Mock;
  isFunctionUnavailable: jest.Mock;
};

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    rpc: jest.Mock;
    auth: {
      signUp: jest.Mock;
      updateUser: jest.Mock;
      refreshSession: jest.Mock;
    };
  };
};

const { put } = jest.requireMock("../../platform/api/core") as {
  put: jest.Mock;
};

const { applyProfileUpdateInTable } = jest.requireMock("./authProfileSync") as {
  applyProfileUpdateInTable: jest.Mock;
};

const { fallbackGetMeFromTable, isUnauthorizedError } = jest.requireMock("./auth.shared") as {
  fallbackGetMeFromTable: jest.Mock;
  isUnauthorizedError: jest.Mock;
};

describe("AuthAPI test verification bypass", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("auto-confirms sign-up fallback users when auth verification bypass is enabled", async () => {
    post.mockImplementation(async (path: string) => {
      if (path === "/auth/register-direct") throw new Error("function-not-found");
      if (path === "/auth/test/confirm-email") return { success: true, userId: "user-1" };
      throw new Error(`Unexpected path ${path}`);
    });
    isFunctionUnavailable.mockImplementation((error: unknown) =>
      String((error as { message?: string })?.message || error || "").includes(
        "function-not-found",
      ),
    );
    supabase.auth.signUp.mockResolvedValue({
      data: { session: null, user: { id: "user-1", identities: [{ id: "identity-1" }] } },
      error: null,
    });

    await expect(
      AuthAPI.registerDirect({
        accountType: "student",
        bio: "",
        categories: [],
        coverImage: "",
        department: "",
        email: "test@example.com",
        gradeYear: "",
        isPrivate: false,
        name: "Test User",
        password: "Password1",
        profileImage: "",
        university: "Test Uni",
        username: "testuser",
      }),
    ).resolves.toEqual({
      success: true,
      userId: "user-1",
      requiresEmailVerification: false,
      sessionReady: false,
    });

    expect(post).toHaveBeenNthCalledWith(
      1,
      "/auth/register-direct",
      expect.objectContaining({
        email: "test@example.com",
        existingUserId: "user-1",
        registrationNonce: expect.any(String),
        username: "testuser",
      }),
      { authMode: "anon" },
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/auth/test/confirm-email",
      { email: "test@example.com" },
      { authMode: "anon" },
    );
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        options: expect.objectContaining({
          data: expect.objectContaining({
            registrationNonce: expect.any(String),
            username: "testuser",
          }),
        }),
      }),
    );
  });

  it("prefers the canonical privacy rpc when available", async () => {
    fallbackGetMeFromTable
      .mockResolvedValueOnce({
        accountType: "student",
        id: "viewer-1",
        isPrivate: false,
        username: "viewer",
      })
      .mockResolvedValueOnce({
        accountType: "student",
        id: "viewer-1",
        isPrivate: true,
        username: "viewer",
      });
    supabase.rpc.mockResolvedValue({ error: null });
    put.mockResolvedValue({ isPrivate: true });
    isFunctionUnavailable.mockReturnValue(false);
    isUnauthorizedError.mockReturnValue(false);
    supabase.auth.updateUser.mockResolvedValue({ error: null });

    await expect(AuthAPI.updatePrivacy(true)).resolves.toEqual({ isPrivate: true });

    expect(supabase.rpc).toHaveBeenCalledWith("update_profile_privacy_with_patch", {
      target_is_private: true,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("falls back to the compat auth route when the privacy rpc is unavailable", async () => {
    fallbackGetMeFromTable.mockResolvedValueOnce({
      accountType: "student",
      id: "viewer-1",
      isPrivate: false,
      username: "viewer",
    });
    supabase.rpc.mockResolvedValue({ error: { message: "function-not-found" } });
    put.mockResolvedValue({ isPrivate: true });
    isFunctionUnavailable.mockImplementation((error: unknown) =>
      String((error as { message?: string })?.message || error || "").includes(
        "function-not-found",
      ),
    );
    isUnauthorizedError.mockReturnValue(false);

    await expect(AuthAPI.updatePrivacy(true)).resolves.toEqual({ isPrivate: true });

    expect(supabase.rpc).toHaveBeenCalledWith("update_profile_privacy_with_patch", {
      target_is_private: true,
    });
    expect(put).toHaveBeenCalledWith(
      "/auth/privacy",
      { isPrivate: true },
      { authMode: "required" },
    );
    expect(applyProfileUpdateInTable).not.toHaveBeenCalled();
  });
});
