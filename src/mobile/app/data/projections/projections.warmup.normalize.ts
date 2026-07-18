import type { NotificationItem } from "../contracts/api";
import { normalizeAlbumProjectionItem } from "../normalizers/albums";
import { normalizeProjectionEvent } from "../normalizers/events";
import {
  mapEnvelopeItems,
  normalizeEnvelope,
  nowEnvelope,
  toHomeProjectionItem,
  toSearchProjectionItem,
} from "./projections.api.helpers";
import { normalizeProjectionValue } from "./projections.common";
import type {
  AppWarmupSearchDiscoveryBundle,
  AppWarmupBundle,
  NotificationBadgeProjection,
  ProfileOverviewProjection,
  SearchProjectionParams,
} from "./projections.types";
import { SEARCH_DISCOVERY_KINDS } from "./searchDiscovery";

export const HOME_WARMUP_SCOPE = "all:all:all:newest";

function normalizeWarmupSearchKind(value: unknown): SearchProjectionParams["kind"] | null {
  return value === "albums" || value === "events" || value === "clubs" || value === "students"
    ? value
    : null;
}

function normalizeWarmupNotificationBadge(value: unknown): NotificationBadgeProjection {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const unreadCount = Number(item.unreadCount ?? item.unread_count ?? 0);
  return {
    id: String(item.id || "notifications"),
    unreadCount: Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0,
  };
}

export function buildEmptySearchDiscoveryBundle(): AppWarmupSearchDiscoveryBundle {
  return {
    albums: nowEnvelope([]),
    clubs: nowEnvelope([]),
    events: nowEnvelope([]),
    students: nowEnvelope([]),
  };
}

export function buildEmptyProfileOverview(viewerUsername: string): ProfileOverviewProjection {
  return {
    capabilities: null,
    followStatus: "none",
    id: viewerUsername || "profile",
    profile: {} as ProfileOverviewProjection["profile"],
    username: viewerUsername,
  };
}

function normalizeWarmupSearchDiscovery(payload: unknown): AppWarmupSearchDiscoveryBundle {
  const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return SEARCH_DISCOVERY_KINDS.reduce<AppWarmupSearchDiscoveryBundle>((acc, kind) => {
    acc[kind] = mapEnvelopeItems(
      normalizeEnvelope<unknown>(source[kind]) || nowEnvelope([]),
      (row) => toSearchProjectionItem(row, kind),
    );
    return acc;
  }, buildEmptySearchDiscoveryBundle());
}

export function normalizeWarmupBundle(payload: unknown): AppWarmupBundle | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;
  const profileOverview = source.profileOverview || source.profile_overview;
  const normalizedProfileOverview =
    profileOverview && typeof profileOverview === "object"
      ? (profileOverview as ProfileOverviewProjection)
      : buildEmptyProfileOverview(
          normalizeProjectionValue(String(source.profileUsername || source.profile_username || "")),
        );
  const searchSource =
    source.search && typeof source.search === "object"
      ? (source.search as Record<string, unknown>)
      : null;
  const searchKind = normalizeWarmupSearchKind(searchSource?.kind || searchSource?.kind_name);
  const searchContent =
    searchKind && searchSource
      ? mapEnvelopeItems(
          normalizeEnvelope<unknown>(searchSource.content) || nowEnvelope([]),
          (row) => toSearchProjectionItem(row, searchKind),
        )
      : null;

  return {
    generatedAt:
      String(source.generatedAt || source.generated_at || "").trim() || new Date().toISOString(),
    home: mapEnvelopeItems(
      normalizeEnvelope<unknown>(source.home || source.home_payload) || nowEnvelope([]),
      toHomeProjectionItem,
    ),
    homeScope: String(source.homeScope || source.home_scope || HOME_WARMUP_SCOPE),
    notificationBadge: normalizeWarmupNotificationBadge(
      source.notificationBadge || source.notification_badge,
    ),
    notifications:
      normalizeEnvelope<NotificationItem>(source.notifications || source.notifications_payload) ||
      nowEnvelope([]),
    profileAlbums: mapEnvelopeItems(
      normalizeEnvelope<unknown>(source.profileAlbums || source.profile_albums) || nowEnvelope([]),
      normalizeAlbumProjectionItem,
    ),
    profileEvents: mapEnvelopeItems(
      normalizeEnvelope<unknown>(source.profileEvents || source.profile_events) || nowEnvelope([]),
      normalizeProjectionEvent,
    ),
    profileOverview: normalizedProfileOverview,
    profileUsername: String(
      source.profileUsername || source.profile_username || normalizedProfileOverview.username || "",
    ).trim(),
    source:
      source.source === "fallback" ||
      source.source === "timeout-backpressure" ||
      source.source === "rpc"
        ? source.source
        : "rpc",
    searchDiscovery: normalizeWarmupSearchDiscovery(
      source.searchDiscovery || source.search_discovery,
    ),
    search:
      searchKind && searchContent && searchSource
        ? {
            content: searchContent,
            kind: searchKind,
            params: {
              categoryFilter:
                String(searchSource.categoryFilter || searchSource.category_filter || "").trim() ||
                undefined,
              feeFilter:
                searchSource.feeFilter === "free" || searchSource.feeFilter === "paid"
                  ? searchSource.feeFilter
                  : searchSource.fee_filter === "free" || searchSource.fee_filter === "paid"
                    ? (searchSource.fee_filter as SearchProjectionParams["feeFilter"])
                    : "",
              queryText:
                String(searchSource.queryText || searchSource.query_text || "").trim() || undefined,
              sortMode:
                String(searchSource.sortMode || searchSource.sort_mode || "").trim() || undefined,
              universityFilter:
                String(
                  searchSource.universityFilter || searchSource.university_filter || "",
                ).trim() || undefined,
            },
            scope: String(searchSource.scope || "").trim(),
          }
        : null,
  };
}
