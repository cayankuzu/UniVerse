const mockRpc = jest.fn();

jest.mock("../../platform/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  executeWarmupProjectionRpc,
  resetWarmupTransportForTests,
} from "./projections.warmup.transport";
import { WARMUP_PROJECTION_RPC_TIMEOUT_MS } from "./projections.warmup.contracts";

describe("warmup projection transport", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetWarmupTransportForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("deduplicates matching requests and aborts the native request on timeout", async () => {
    let capturedSignal: AbortSignal | null = null;
    const pending = new Promise<never>(() => undefined);
    mockRpc.mockReturnValue({
      abortSignal: (signal: AbortSignal) => {
        capturedSignal = signal;
        return pending;
      },
    });

    const first = executeWarmupProjectionRpc({ viewer_id: "viewer-1" });
    const second = executeWarmupProjectionRpc({ viewer_id: "viewer-1" });
    expect(first).toBe(second);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(WARMUP_PROJECTION_RPC_TIMEOUT_MS);
    await expect(first).resolves.toMatchObject({ timedOut: true });
    expect(capturedSignal).not.toBeNull();
    expect((capturedSignal as unknown as AbortSignal).aborted).toBe(true);
  });
});
