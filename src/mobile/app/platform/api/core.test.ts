import { del, get } from "./core";

const mockDebugLog = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockLogEvent = jest.fn();
const mockRefreshSession = jest.fn();
const mockStartObservedTimer: jest.Mock = jest.fn(() => jest.fn());

jest.mock("../config/runtime", () => ({
  RUNTIME_FLAGS: {
    disableLegacyEdgeReads: true,
  },
}));

jest.mock("../config/publicEnv", () => ({
  SUPABASE_PUBLIC_ANON_KEY: "anon-key",
  SUPABASE_FUNCTIONS_BASE_URL: "https://example.test",
}));

jest.mock("../../platform/logging/logger", () => ({
  debugLog: (...args: any[]) => mockDebugLog(...args),
}));

jest.mock("../observability", () => ({
  logEvent: (...args: any[]) => mockLogEvent(...args),
  startObservedTimer: (params: any) => mockStartObservedTimer(params),
}));

jest.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
      getUser: (...args: any[]) => mockGetUser(...args),
      refreshSession: (...args: any[]) => mockRefreshSession(...args),
    },
  },
}));

function createResponse(status: number, body: unknown): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

async function flushUntilFetchCalls(fetchMock: jest.Mock, expectedCalls: number) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await Promise.resolve();
    if (fetchMock.mock.calls.length >= expectedCalls) return;
  }
}

describe("api core auth retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "stale-token" } },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "viewer-1" } },
      error: null,
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
      error: null,
    });
  });

  it("refreshes and retries delete requests after a 401 unauthorized response", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(createResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(createResponse(200, { success: true }));

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
    });

    await expect(del<{ success: true }>("/events/event-1")).resolves.toEqual({ success: true });

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer stale-token",
    );
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer fresh-token",
    );
  });

  it("overrides stale authorization headers with the latest session token", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(createResponse(401, { error: "Invalid JWT" }))
      .mockResolvedValueOnce(createResponse(200, { success: true }));

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
    });

    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "current-session-token" } },
      error: null,
    });

    await expect(
      del<{ success: true }>("/events/event-2", {
        headers: {
          Authorization: "Bearer stale-header-token",
          "x-trace-id": "trace-1",
        },
      }),
    ).resolves.toEqual({ success: true });

    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer current-session-token",
    );
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer fresh-token",
    );
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("x-trace-id")).toBe("trace-1");
  });

  it("recovers a missing auth token before the first request", async () => {
    const fetchMock = jest.fn().mockResolvedValue(createResponse(200, { success: true }));

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
    });

    mockGetSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })
      .mockResolvedValue({
        data: { session: null },
        error: null,
      });
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
      error: null,
    });

    await expect(del<{ success: true }>("/events/event-3")).resolves.toEqual({ success: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer fresh-token",
    );
  });

  it("honors caller abort signals without marking them as timeouts", async () => {
    const abortController = new AbortController();
    const fetchMock = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const rejectAbort = () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };
          if (init?.signal?.aborted) {
            rejectAbort();
            return;
          }
          init?.signal?.addEventListener("abort", () => {
            rejectAbort();
          });
        }),
    );

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
    });

    const requestPromise = get("/search?q=test", {
      signal: abortController.signal,
    });
    abortController.abort();

    await expect(requestPromise).rejects.toMatchObject({
      httpStatus: 0,
      isTimeout: false,
      message: "Istek iptal edildi.",
    });
  });

  it("does not dedupe or response-cache GET requests with caller-owned signals", async () => {
    const resolvers: Array<() => void> = [];
    const fetchMock = jest.fn(
      (_url: string) =>
        new Promise<Response>((resolve) => {
          const callNumber = fetchMock.mock.calls.length;
          resolvers.push(() => resolve(createResponse(200, { callNumber })));
        }),
    );

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
    });

    const first = get<{ callNumber: number }>("/search?q=signal", {
      signal: new AbortController().signal,
    });
    const second = get<{ callNumber: number }>("/search?q=signal", {
      signal: new AbortController().signal,
    });

    await flushUntilFetchCalls(fetchMock, 2);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolvers.forEach((resolve) => resolve());

    await expect(first).resolves.toEqual({ callNumber: 1 });
    await expect(second).resolves.toEqual({ callNumber: 2 });

    const third = get<{ callNumber: number }>("/search?q=signal");
    await flushUntilFetchCalls(fetchMock, 3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolvers[2]?.();
    await expect(third).resolves.toEqual({ callNumber: 3 });
  });

  it("preserves plain text error bodies", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("plain failure"),
    });

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
    });

    await expect(del("/events/event-4")).rejects.toThrow("plain failure");
  });
});
