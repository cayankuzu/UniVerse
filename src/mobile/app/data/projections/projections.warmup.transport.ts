import { supabase } from "../../platform/supabase";
import {
  WARMUP_PROJECTION_RPC_TIMEOUT_MS,
  WARMUP_RPC_TIMEOUT,
  type WarmupBundleParams,
} from "./projections.warmup.contracts";

type WarmupRpcResult = {
  data: unknown;
  error: { message: string } | null;
  timedOut: boolean;
};

const inFlightWarmups = new Map<string, Promise<WarmupRpcResult>>();

export function buildWarmupRpcParams(params: {
  normalizedViewerUsername: string;
  request: WarmupBundleParams;
}) {
  return {
    search_category_filter: null,
    search_fee_filter: null,
    search_kind_name: null,
    search_query_text: null,
    search_scope: null,
    search_sort_mode: "newest",
    search_university_filter: null,
    viewer_id: params.request.viewerId || null,
    viewer_username: params.normalizedViewerUsername || null,
  };
}

export function executeWarmupProjectionRpc(params: Record<string, unknown>) {
  const requestKey = JSON.stringify(params);
  const existing = inFlightWarmups.get(requestKey);
  if (existing) return existing;

  const controller = new AbortController();
  const task = (async (): Promise<WarmupRpcResult> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const rpcRequest = supabase.rpc("app_warmup_projection", params);
    const abortableRequest = rpcRequest as typeof rpcRequest & {
      abortSignal?: (signal: AbortSignal) => typeof rpcRequest;
    };
    const pendingRequest = abortableRequest.abortSignal
      ? abortableRequest.abortSignal(controller.signal)
      : rpcRequest;

    try {
      const result = await Promise.race<Awaited<typeof pendingRequest> | typeof WARMUP_RPC_TIMEOUT>(
        [
          pendingRequest,
          new Promise<typeof WARMUP_RPC_TIMEOUT>((resolve) => {
            timeoutId = setTimeout(() => {
              resolve(WARMUP_RPC_TIMEOUT);
              controller.abort();
            }, WARMUP_PROJECTION_RPC_TIMEOUT_MS);
          }),
        ],
      );

      if (result === WARMUP_RPC_TIMEOUT) {
        return {
          data: null,
          error: { message: `client-timeout:${WARMUP_PROJECTION_RPC_TIMEOUT_MS}` },
          timedOut: true,
        };
      }

      return { data: result.data, error: result.error, timedOut: false };
    } catch (error) {
      return {
        data: null,
        error: { message: String((error as { message?: string })?.message || error || "") },
        timedOut: controller.signal.aborted,
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  })();

  inFlightWarmups.set(requestKey, task);
  const cleanup = () => {
    if (inFlightWarmups.get(requestKey) === task) inFlightWarmups.delete(requestKey);
  };
  void task.then(cleanup, cleanup);
  return task;
}

export function resetWarmupTransportForTests() {
  inFlightWarmups.clear();
}
