import { supabase } from "../../platform/supabase";
import { tryProjectionRpc } from "./projections.api.helpers";
import { resetProjectionRpcStateForTests } from "./projections.rpc";

jest.mock("../../platform/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock("../../platform/logging/logger", () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));

jest.mock("../../platform/api/core", () => ({
  isFunctionUnavailable: jest.fn(() => false),
}));

describe("notification projection rpc saturation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    resetProjectionRpcStateForTests();
  });

  it("allows badge and inbox warmups to overlap before rejecting a third hot request", async () => {
    type RpcResult = {
      data: {
        deleted_ids: string[];
        delta_token: string;
        items: [];
        next_cursor: null;
        server_time: string;
        updated_items: [];
      };
      error: null;
    };
    const pendingResolvers: Array<(value: RpcResult) => void> = [];
    (supabase.rpc as jest.Mock).mockImplementation(
      () =>
        new Promise<RpcResult>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );

    const badgeRequest = tryProjectionRpc<{ id: string }>("notification_badge_projection", {
      delta_token: null,
      since: null,
      viewer_id: "viewer-1",
    });
    const inboxRequest = tryProjectionRpc<{ id: string }>("notifications_projection", {
      filter_name: "all",
      limit_count: 12,
      viewer_id: "viewer-1",
    });

    await expect(
      tryProjectionRpc<{ id: string }>("notifications_projection", {
        filter_name: "all",
        limit_count: 12,
        viewer_id: "viewer-2",
      }),
    ).resolves.toBeNull();

    expect(supabase.rpc).toHaveBeenCalledTimes(2);

    pendingResolvers[0]?.({
      data: {
        deleted_ids: [],
        delta_token: "delta-badge",
        items: [],
        next_cursor: null,
        server_time: "2026-03-12T00:00:30.000Z",
        updated_items: [],
      },
      error: null,
    });
    pendingResolvers[1]?.({
      data: {
        deleted_ids: [],
        delta_token: "delta-inbox",
        items: [],
        next_cursor: null,
        server_time: "2026-03-12T00:00:31.000Z",
        updated_items: [],
      },
      error: null,
    });

    await expect(badgeRequest).resolves.toEqual({
      deletedIds: [],
      deltaToken: "delta-badge",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:30.000Z",
      updatedItems: [],
    });
    await expect(inboxRequest).resolves.toEqual({
      deletedIds: [],
      deltaToken: "delta-inbox",
      items: [],
      nextCursor: null,
      serverTime: "2026-03-12T00:00:31.000Z",
      updatedItems: [],
    });
  });

  it("aborts the physical RPC before falling back on timeout", async () => {
    jest.useFakeTimers();
    let receivedSignal: AbortSignal | null = null;
    const abortSignal = jest.fn((signal: AbortSignal) => {
      receivedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("rpc aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    });
    (supabase.rpc as jest.Mock).mockReturnValue({ abortSignal });

    const request = tryProjectionRpc("notification_badge_projection", {
      viewer_id: "viewer-timeout",
    });
    await jest.advanceTimersByTimeAsync(2_200);

    await expect(request).resolves.toBeNull();
    expect(abortSignal).toHaveBeenCalledTimes(1);
    expect((receivedSignal as AbortSignal | null)?.aborted).toBe(true);
  });
});
