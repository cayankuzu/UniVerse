import { supabase } from "../../platform/supabase";
import { tryProjectionRpc } from "./projections.api.helpers";
import { resetProjectionRpcStateForTests } from "./projections.rpc";

jest.mock("../../platform/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock("../../platform/logging/logger", () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));
jest.mock("../../platform/api/core", () => ({
  isFunctionUnavailable: jest.fn(() => false),
}));

describe("projection RPC cancellation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProjectionRpcStateForTests();
  });

  it("aborts an obsolete RPC when its caller signal is cancelled", async () => {
    const abortSignal = jest.fn((signal: AbortSignal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    (supabase.rpc as jest.Mock).mockReturnValue({ abortSignal });
    const controller = new AbortController();

    const request = tryProjectionRpc<{ id: string }>(
      "search_results_projection_v2",
      {
        kind_name: "albums",
        limit_count: 20,
        query_text: "first",
        viewer_id: "viewer-1",
      },
      controller.signal,
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(Object));
  });

  it("rejects immediately when the caller signal is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      tryProjectionRpc("search_results_projection_v2", {}, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects when cancellation happens while a non-abortable RPC is resolving", async () => {
    let resolveRpc: ((value: { data: { items: [] }; error: null }) => void) | undefined;
    (supabase.rpc as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve;
      }),
    );
    const controller = new AbortController();
    const request = tryProjectionRpc("search_results_projection_v2", {}, controller.signal);

    controller.abort();
    resolveRpc?.({ data: { items: [] }, error: null });

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
