import { post } from "../../platform/api/core";
import { debugWarn } from "../../platform/logging/logger";

const PUSH_DISPATCH_WAKEUP_PATH = "/push/dispatch";
const PUSH_DISPATCH_WAKEUP_TIMEOUT_MS = 4500;

export function triggerPushDispatchWakeup(reason: string) {
  const onError = (error: unknown) => {
    debugWarn("NOTIFICATIONS/PUSH", "push-dispatch-wakeup-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "push-dispatch-wakeup-failed",
      ),
      reason: String(reason || "").trim() || "unknown",
    });
  };

  try {
    void Promise.resolve(
      post<{ success?: boolean }>(
        PUSH_DISPATCH_WAKEUP_PATH,
        { drain: true },
        {
          authMode: "anon",
          timeoutMs: PUSH_DISPATCH_WAKEUP_TIMEOUT_MS,
        },
      ),
    ).catch(onError);
  } catch (error) {
    onError(error);
  }
}
