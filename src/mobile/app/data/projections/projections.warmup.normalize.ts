import {
  mapEnvelopeItems,
  normalizeEnvelope,
  nowEnvelope,
  toHomeProjectionItem,
} from "./projections.api.helpers";
import type { AppWarmupBundle, NotificationBadgeProjection } from "./projections.types";

export const HOME_WARMUP_SCOPE = "all:all:all:newest";

function normalizeNotificationBadge(value: unknown): NotificationBadgeProjection {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const unreadCount = Number(item.unreadCount ?? item.unread_count ?? 0);
  return {
    id: String(item.id || "notifications"),
    unreadCount: Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0,
  };
}

export function normalizeWarmupBundle(payload: unknown): AppWarmupBundle | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;
  return {
    generatedAt:
      String(source.generatedAt || source.generated_at || "").trim() || new Date().toISOString(),
    home: mapEnvelopeItems(
      normalizeEnvelope<unknown>(source.home || source.home_payload) || nowEnvelope([]),
      toHomeProjectionItem,
    ),
    homeScope: String(source.homeScope || source.home_scope || HOME_WARMUP_SCOPE),
    notificationBadge: normalizeNotificationBadge(
      source.notificationBadge || source.notification_badge,
    ),
    source: "rpc",
  };
}

export function createBackpressureWarmupBundle(homeScope = HOME_WARMUP_SCOPE): AppWarmupBundle {
  return {
    generatedAt: new Date().toISOString(),
    home: nowEnvelope([]),
    homeScope,
    notificationBadge: { id: "notifications", unreadCount: 0 },
    source: "timeout-backpressure",
  };
}
