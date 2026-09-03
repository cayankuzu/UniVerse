const mockClearSensitiveClientState = jest.fn();
const mockClearSupabaseAuthStorage = jest.fn();
const mockSignOut = jest.fn();

jest.mock("../../platform/supabase", () => ({
  clearSupabaseAuthStorage: (...args: unknown[]) => mockClearSupabaseAuthStorage(...args),
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

jest.mock("./clearSensitiveClientState", () => ({
  clearSensitiveClientState: (...args: unknown[]) => mockClearSensitiveClientState(...args),
}));

import { hardSignOut } from "./authSessionBoundary";

describe("hardSignOut", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearSensitiveClientState.mockResolvedValue(undefined);
    mockClearSupabaseAuthStorage.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("preserves push cleanup proof through ordinary logout by default", async () => {
    await hardSignOut("logout");

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mockClearSupabaseAuthStorage).toHaveBeenCalledTimes(1);
    expect(mockClearSensitiveClientState).toHaveBeenCalledWith({
      reason: "logout",
    });
  });

  it("clears push proof only for a confirmed account-delete cascade", async () => {
    await hardSignOut("delete-account", { clearPushRegistration: true });

    expect(mockClearSensitiveClientState).toHaveBeenCalledWith({
      clearPushRegistration: true,
      reason: "delete-account",
    });
  });

  it("still attempts sensitive in-memory cleanup and propagates its failure", async () => {
    const cleanupError = new Error("sensitive cleanup failed");
    mockClearSensitiveClientState.mockRejectedValue(cleanupError);

    await expect(hardSignOut("logout")).rejects.toBe(cleanupError);

    expect(mockClearSupabaseAuthStorage).toHaveBeenCalledTimes(1);
    expect(mockClearSensitiveClientState).toHaveBeenCalledWith({ reason: "logout" });
  });

  it("attempts sensitive cleanup even when auth-storage cleanup fails", async () => {
    const storageError = new Error("auth storage cleanup failed");
    mockClearSupabaseAuthStorage.mockRejectedValue(storageError);

    await expect(hardSignOut("logout")).rejects.toBe(storageError);

    expect(mockClearSensitiveClientState).toHaveBeenCalledWith({ reason: "logout" });
  });
});
