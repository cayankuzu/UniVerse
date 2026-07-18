const mockRefreshSession = jest.fn();

jest.mock("./index", () => ({
  supabase: {
    auth: {
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

import {
  refreshSupabaseSessionSingleFlight,
  resetSessionRefreshSingleFlightForTests,
} from "./sessionRefresh";

describe("Supabase refresh single-flight", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionRefreshSingleFlightForTests();
  });

  it("shares one refresh across concurrent 401 recoveries", async () => {
    let resolveRefresh: ((value: unknown) => void) | null = null;
    mockRefreshSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const first = refreshSupabaseSessionSingleFlight();
    const second = refreshSupabaseSessionSingleFlight();
    const third = refreshSupabaseSessionSingleFlight();

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);

    (resolveRefresh as ((value: unknown) => void) | null)?.({
      data: { session: { access_token: "fresh" } },
      error: null,
    });
    await expect(Promise.all([first, second, third])).resolves.toHaveLength(3);
  });

  it("allows a new refresh after the shared attempt settles", async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null });

    await refreshSupabaseSessionSingleFlight();
    await refreshSupabaseSessionSingleFlight();

    expect(mockRefreshSession).toHaveBeenCalledTimes(2);
  });
});
