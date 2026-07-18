import { logError } from "../../../platform/observability";

export function reportProfileUiError(error: unknown, operation: string) {
  logError(error, {
    captureInSentry: false,
    meta: { operation, scope: "profile-ui" },
    name: `profile-${operation}-failed`,
  });
}
