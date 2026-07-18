import { logError } from "../../../platform/observability";

export function reportContentCardUiError(
  error: unknown,
  operation: string,
  meta?: Record<string, unknown>,
) {
  logError(error, {
    captureInSentry: false,
    meta: { ...meta, operation, scope: "content-card-ui" },
    name: `content-card-${operation}-failed`,
  });
}
