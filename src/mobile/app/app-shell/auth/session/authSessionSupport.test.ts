import type { Session } from "@supabase/supabase-js";

const mockGetSession = jest.fn();
const mockSetSession = jest.fn();
const mockClearPersistedAuthSession = jest.fn();
const mockGetPersistedAuthSession = jest.fn();
const mockGetPersistedAuthSnapshot = jest.fn();
const mockSavePersistedAuthSession = jest.fn();
const mockSavePersistedAuthSnapshot = jest.fn();

jest.mock("../../../platform/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
    },
  },
}));

jest.mock("../../../platform/storage/authSession", () => ({
  clearPersistedAuthSession: (...args: unknown[]) => mockClearPersistedAuthSession(...args),
  getPersistedAuthSession: (...args: unknown[]) => mockGetPersistedAuthSession(...args),
  getPersistedAuthSnapshot: (...args: unknown[]) => mockGetPersistedAuthSnapshot(...args),
  savePersistedAuthSession: (...args: unknown[]) => mockSavePersistedAuthSession(...args),
  savePersistedAuthSnapshot: (...args: unknown[]) => mockSavePersistedAuthSnapshot(...args),
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

describe("authSessionSupport", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetSession.mockReset();
    mockSetSession.mockReset();
    mockClearPersistedAuthSession.mockReset();
    mockGetPersistedAuthSession.mockReset();
    mockGetPersistedAuthSnapshot.mockReset();
    mockSavePersistedAuthSession.mockReset();
    mockSavePersistedAuthSnapshot.mockReset();
  });

  it("serializes concurrent persisted session restores into a single setSession call", async () => {
    const session = createSession();
    let resolveSetSession:
      ((value: { data: { session: Session | null }; error: null }) => void) | undefined;

    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockGetPersistedAuthSession.mockResolvedValue({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    mockSetSession.mockImplementation(
      () =>
        new Promise<{ data: { session: Session | null }; error: null }>((resolve) => {
          resolveSetSession = resolve;
        }),
    );

    const { getActiveOrPersistedSession } =
      require("./authSessionSupport") as typeof import("./authSessionSupport");

    const pendingA = getActiveOrPersistedSession();
    const pendingB = getActiveOrPersistedSession();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(resolveSetSession).toBeDefined();
    resolveSetSession!({ data: { session }, error: null });
    await expect(Promise.all([pendingA, pendingB])).resolves.toEqual([session, session]);
    expect(mockSavePersistedAuthSession).toHaveBeenCalledTimes(1);
    expect(mockSavePersistedAuthSession).toHaveBeenCalledWith(session);
  });

  it("reuses an already active session instead of restoring again", async () => {
    const session = createSession();

    mockGetSession.mockResolvedValue({ data: { session } });

    const { getActiveOrPersistedSession } =
      require("./authSessionSupport") as typeof import("./authSessionSupport");

    await expect(getActiveOrPersistedSession()).resolves.toBe(session);

    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockGetPersistedAuthSession).not.toHaveBeenCalled();
    expect(mockSavePersistedAuthSession).toHaveBeenCalledWith(session);
  });

  it("prefers a newly signed-in session over an older pending bootstrap lookup", async () => {
    const session = createSession();
    let resolveBootstrap: ((value: { data: { session: Session | null } }) => void) | undefined;

    mockGetSession.mockImplementationOnce(
      () =>
        new Promise<{ data: { session: Session | null } }>((resolve) => {
          resolveBootstrap = resolve;
        }),
    );
    mockGetPersistedAuthSession.mockResolvedValue(null);
    mockSavePersistedAuthSession.mockResolvedValue(undefined);

    const { getActiveOrPersistedSession, persistAuthSession } =
      require("./authSessionSupport") as typeof import("./authSessionSupport");

    const pendingBootstrap = getActiveOrPersistedSession();
    await Promise.resolve();
    expect(resolveBootstrap).toBeDefined();

    await persistAuthSession(session);
    await expect(getActiveOrPersistedSession()).resolves.toBe(session);

    resolveBootstrap!({ data: { session: null } });
    await expect(pendingBootstrap).resolves.toBeNull();
  });
});
