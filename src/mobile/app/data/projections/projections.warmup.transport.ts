import { supabase } from "../../platform/supabase";
import {
  WARMUP_PROJECTION_RPC_TIMEOUT_MS,
  WARMUP_RPC_TIMEOUT,
  type WarmupBundleParams,
} from "./projections.warmup.contracts";

export function buildWarmupRpcParams(params: {
  normalizedViewerUsername: string;
  request: WarmupBundleParams;
}) {
  const { normalizedViewerUsername, request } = params;
  return {
    search_category_filter: request.search?.categoryFilter || null,
    search_fee_filter:
      request.search?.feeFilter === "free" || request.search?.feeFilter === "paid"
        ? request.search.feeFilter
        : null,
    search_kind_name: request.search?.kind || null,
    search_query_text: request.search?.queryText || null,
    search_scope: request.search?.scope || null,
    search_sort_mode: request.search?.sortMode || "newest",
    search_university_filter: request.search?.universityFilter || null,
    viewer_id: request.viewerId || null,
    viewer_username: normalizedViewerUsername || null,
  };
}

export async function executeWarmupProjectionRpc(params: Record<string, unknown>) {
  const request = supabase.rpc("app_warmup_projection", params);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const result = await Promise.race<Awaited<typeof request> | typeof WARMUP_RPC_TIMEOUT>([
      request,
      new Promise<typeof WARMUP_RPC_TIMEOUT>((resolve) => {
        timeoutId = setTimeout(() => resolve(WARMUP_RPC_TIMEOUT), WARMUP_PROJECTION_RPC_TIMEOUT_MS);
      }),
    ]);

    if (result === WARMUP_RPC_TIMEOUT) {
      return {
        data: null,
        error: { message: `client-timeout:${WARMUP_PROJECTION_RPC_TIMEOUT_MS}` },
        timedOut: true,
      };
    }

    return {
      data: result.data,
      error: result.error,
      timedOut: false,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
