import { debugWarn } from "../../platform/logging/logger";
import { withClientMutationId } from "../mutations/clientMutation";
import { supabase } from "../../platform/supabase";

export type MutationRpcFallbackResult = {
  source: "base-rpc-fallback" | "patch-rpc" | "patch-rpc-recovered";
};

function warnSocialRpcFailure(
  stage: "fallback" | "fallback-verify" | "primary" | "primary-verify",
  rpcName: string,
  error: unknown,
) {
  const normalizedError = error as {
    code?: string;
    details?: string;
    message?: string;
  } | null;
  debugWarn("SOCIAL/RPC", "mutation-rpc-failed", {
    code: normalizedError?.code,
    details: normalizedError?.details,
    message: String(normalizedError?.message || error || "").slice(0, 160),
    rpcName,
    stage,
  });
}

export async function executeMutationRpcWithFallback(params: {
  fallbackArgs?: Record<string, unknown>;
  fallbackName?: string;
  primaryArgs: Record<string, unknown>;
  primaryName: string;
  verifyAfterFallbackError?: boolean;
  verifyAfterPrimaryError?: () => Promise<boolean>;
  mutationOptions?: { clientMutationId?: string | null } | null;
}) {
  const primaryArgs = {
    ...params.primaryArgs,
    ...withClientMutationId({}, params.mutationOptions || undefined),
  };

  try {
    const { error } = await supabase.rpc(params.primaryName, primaryArgs);
    if (!error) {
      return { source: "patch-rpc" } satisfies MutationRpcFallbackResult;
    }
    warnSocialRpcFailure("primary", params.primaryName, error);
  } catch (error) {
    warnSocialRpcFailure("primary", params.primaryName, error);
  }

  if (params.verifyAfterPrimaryError) {
    try {
      const recovered = await params.verifyAfterPrimaryError();
      if (recovered) {
        return { source: "patch-rpc-recovered" } satisfies MutationRpcFallbackResult;
      }
    } catch (error) {
      warnSocialRpcFailure("primary-verify", params.primaryName, error);
    }
  }

  if (!params.fallbackName) return null;

  try {
    const { error } = await supabase.rpc(params.fallbackName, params.fallbackArgs || {});
    if (!error) {
      return { source: "base-rpc-fallback" } satisfies MutationRpcFallbackResult;
    }
    warnSocialRpcFailure("fallback", params.fallbackName, error);
  } catch (error) {
    warnSocialRpcFailure("fallback", params.fallbackName, error);
  }

  if (params.verifyAfterFallbackError && params.verifyAfterPrimaryError) {
    try {
      const recovered = await params.verifyAfterPrimaryError();
      if (recovered) {
        return { source: "patch-rpc-recovered" } satisfies MutationRpcFallbackResult;
      }
    } catch (error) {
      warnSocialRpcFailure("fallback-verify", params.fallbackName, error);
    }
  }

  return null;
}

export async function readBlockedState(blockerId: string, blockedId: string) {
  if (!blockerId || !blockedId) return { blocked: false };
  const { data: snapshotRows, error: snapshotError } = await supabase.rpc(
    "viewer_blocked_snapshot",
    {
      viewer_id: blockerId,
    },
  );
  if (!snapshotError && Array.isArray(snapshotRows)) {
    const blocked = snapshotRows.some((row) => {
      const rowUserId = String(
        (row as { user_id?: string | null; userId?: string | null })?.user_id ||
          (row as { userId?: string | null })?.userId ||
          "",
      ).trim();
      return rowUserId === blockedId;
    });
    return { blocked };
  }

  const [{ data: outgoing, error: outgoingError }, { data: incoming, error: incomingError }] =
    await Promise.all([
      supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", blockerId)
        .eq("blocked_id", blockedId)
        .maybeSingle(),
      supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", blockedId)
        .eq("blocked_id", blockerId)
        .maybeSingle(),
    ]);
  if (outgoingError && incomingError) return { blocked: false };
  return { blocked: Boolean(outgoing || incoming) };
}
