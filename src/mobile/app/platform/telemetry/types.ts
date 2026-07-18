export type TelemetryCategory =
  | "api_request"
  | "error"
  | "mutation"
  | "projection"
  | "security"
  | "screen"
  | "screen_sync"
  | "upload";

export interface TelemetryEvent {
  category: TelemetryCategory;
  durationMs?: number;
  meta?: Record<string, unknown>;
  name: string;
  path?: string;
  screenKey?: string;
  status?: "error" | "ok" | "rollback" | "skipped";
  timestamp?: string;
}
