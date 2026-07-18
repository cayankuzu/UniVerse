import type { ClientMutationOptions } from "../../mutations/clientMutation";
import { withClientMutationId } from "../../mutations/clientMutation";
import { debugWarn } from "../../../platform/logging/logger";
import { supabase } from "../../../platform/supabase";

export type EventToggleRpcSource =
  | "patch-rpc"
  | "patch-rpc-refreshed"
  | "patch-rpc-recovered"
  | "base-rpc-fallback"
  | "base-rpc-refreshed"
  | "base-rpc-recovered";

type EventToggleRpcResult<T> = {
  error: unknown;
  result: T | null;
  source: EventToggleRpcSource | null;
};

type ExecuteEventToggleRpcParams<T> = {
  baseArgs: Record<string, unknown>;
  baseName: string;
  options?: ClientMutationOptions | null;
  parseResult: (data: unknown) => T | null;
  patchName: string;
  verifyAfterError?: () => Promise<T | null>;
};

function isRpcAuthError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || "")
    .trim()
    .toLowerCase();
  return (
    message.includes("invalid jwt") ||
    message.includes("jwt") ||
    message.includes("unauthorized") ||
    message.includes("auth session missing")
  );
}

async function refreshEventToggleSession(rpcName: string) {
  try {
    return await Promise.resolve(supabase.auth.refreshSession());
  } catch (error) {
    debugWarn("CONTENT/EVENTS", "event-toggle-session-refresh-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "event-toggle-session-refresh-failed",
      ),
      rpcName,
    });
    return null;
  }
}

async function runRpcAttempt<T>(params: {
  args: Record<string, unknown>;
  name: string;
  parseResult: (data: unknown) => T | null;
  refreshSource: EventToggleRpcSource;
  source: EventToggleRpcSource;
}): Promise<EventToggleRpcResult<T>> {
  const tryOnce = async () => {
    const { data, error } = await supabase.rpc(params.name, params.args);
    if (!error) {
      const parsed = params.parseResult(data);
      if (parsed !== null) {
        return { error: null, result: parsed };
      }
    }
    return { error: error || new Error(`${params.name} failed`), result: null };
  };

  let attempt = await tryOnce();
  if (attempt.result) {
    return { ...attempt, source: params.source };
  }

  if (!isRpcAuthError(attempt.error)) {
    return { ...attempt, source: null };
  }

  const refresh = await refreshEventToggleSession(params.name);
  if (!refresh?.data?.session?.access_token) {
    return { ...attempt, source: null };
  }

  attempt = await tryOnce();
  if (attempt.result) {
    return { ...attempt, source: params.refreshSource };
  }

  return { ...attempt, source: null };
}

export async function executeEventToggleRpcWithFallback<T>(
  params: ExecuteEventToggleRpcParams<T>,
): Promise<EventToggleRpcResult<T>> {
  const patchAttempt = await runRpcAttempt({
    args: withClientMutationId(params.baseArgs, params.options),
    name: params.patchName,
    parseResult: params.parseResult,
    refreshSource: "patch-rpc-refreshed",
    source: "patch-rpc",
  });
  if (patchAttempt.result) {
    return patchAttempt;
  }

  if (params.verifyAfterError) {
    const recovered = await params.verifyAfterError();
    if (recovered !== null) {
      return { error: patchAttempt.error, result: recovered, source: "patch-rpc-recovered" };
    }
  }

  const baseAttempt = await runRpcAttempt({
    args: params.baseArgs,
    name: params.baseName,
    parseResult: params.parseResult,
    refreshSource: "base-rpc-refreshed",
    source: "base-rpc-fallback",
  });
  if (baseAttempt.result) {
    return baseAttempt;
  }

  if (params.verifyAfterError) {
    const recovered = await params.verifyAfterError();
    if (recovered !== null) {
      return { error: baseAttempt.error, result: recovered, source: "base-rpc-recovered" };
    }
  }

  return { error: baseAttempt.error || patchAttempt.error, result: null, source: null };
}
