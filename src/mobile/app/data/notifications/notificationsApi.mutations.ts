import type { SuccessResponse } from "../contracts/api";
import { supabase } from "../../platform/supabase";
import { startObservedTimer } from "../../platform/observability";
import type { ClientMutationOptions } from "../mutations/clientMutation";
import { withClientMutationId } from "../mutations/clientMutation";

async function tryNotificationPatchMutation(
  rpcName: string,
  params: Record<string, unknown>,
  options?: ClientMutationOptions,
) {
  const rpcParams = withClientMutationId(params, options);
  const { data, error } =
    Object.keys(rpcParams).length > 0
      ? await supabase.rpc(rpcName, rpcParams)
      : await supabase.rpc(rpcName);
  return {
    data,
    success: !error && Boolean(data),
  };
}

async function tryNotificationFallbackMutation(
  rpcName: string,
  params: Record<string, unknown>,
  rpcSuccess: (data: unknown) => boolean,
) {
  const { data, error } =
    Object.keys(params).length > 0
      ? await supabase.rpc(rpcName, params)
      : await supabase.rpc(rpcName);
  if (!error && rpcSuccess(data)) {
    return { source: "rpc" as const, success: true };
  }
  return { source: "failed" as const, success: false };
}

export async function markAllNotificationsReadRequest(
  options?: ClientMutationOptions,
): Promise<SuccessResponse> {
  const stopTelemetry = startObservedTimer({
    category: "mutation",
    meta: { target: "notifications" },
    name: "notifications-mark-all-read",
  });
  const patchResult = await tryNotificationPatchMutation(
    "mark_notifications_read_all_with_patch",
    {},
    options,
  );
  if (patchResult.success) {
    stopTelemetry("ok", { source: "patch-rpc" });
    return { success: true };
  }

  const fallbackResult = await tryNotificationFallbackMutation(
    "mark_notifications_read_all",
    {},
    () => true,
  );
  stopTelemetry(fallbackResult.success ? "ok" : "error", {
    source: fallbackResult.source,
  });
  return { success: fallbackResult.success };
}

export async function markNotificationReadRequest(
  notificationId: string,
  options?: ClientMutationOptions,
): Promise<SuccessResponse> {
  const id = String(notificationId || "").trim();
  if (!id) return { success: false };
  const stopTelemetry = startObservedTimer({
    category: "mutation",
    meta: { target: "notification" },
    name: "notification-mark-read",
  });

  const patchResult = await tryNotificationPatchMutation(
    "mark_notification_read_with_patch",
    { target_notification_id: id },
    options,
  );
  if (patchResult.success) {
    stopTelemetry("ok", { source: "patch-rpc" });
    return { success: true };
  }

  const fallbackResult = await tryNotificationFallbackMutation(
    "mark_notification_read",
    { target_notification_id: id },
    (data) => Boolean(data),
  );
  stopTelemetry(fallbackResult.success ? "ok" : "error", {
    source: fallbackResult.source,
  });
  return { success: fallbackResult.success };
}
