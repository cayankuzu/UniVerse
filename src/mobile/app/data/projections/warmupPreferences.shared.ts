import type {
  HomeProjectionParams,
  ProfileContentTab,
  SearchProjectionParams,
} from "./projections.types";
import { debugWarn } from "../../platform/logging/logger";
import type { PersistedLandingAffinity } from "./warmupLandingAffinity";

const LAST_HOME_SCOPE_PREFIX = "warmup:last-home-scope:v1:";
const LANDING_AFFINITY_PREFIX = "warmup:landing-affinity:v1:";
const LAST_PROFILE_TAB_PREFIX = "warmup:last-profile-tab:v1:";
const LAST_SEARCH_SCOPE_PREFIX = "warmup:last-search-scope:v1:";

export interface PersistedHomeWarmupScope {
  entityFilter: NonNullable<HomeProjectionParams["entityFilter"]>;
  scope: string;
  sortOption: NonNullable<HomeProjectionParams["sortOption"]>;
  sourceFilter: NonNullable<HomeProjectionParams["sourceFilter"]>;
  typeFilter: NonNullable<HomeProjectionParams["typeFilter"]>;
  updatedAt: string;
}

export interface PersistedSearchWarmupScope {
  categoryFilter?: string;
  feeFilter?: SearchProjectionParams["feeFilter"];
  kind: SearchProjectionParams["kind"];
  queryText?: string;
  scope: string;
  sortMode?: string;
  universityFilter?: string;
  updatedAt: string;
}

export interface PersistedWarmupPreferences {
  landingAffinity: PersistedLandingAffinity | null;
  lastHomeScope: PersistedHomeWarmupScope | null;
  lastProfileTab: ProfileContentTab | null;
  lastSearchScope: PersistedSearchWarmupScope | null;
}

const warmupPreferencesMemoryCache = new Map<string, PersistedWarmupPreferences>();

export function normalizeViewerKey(viewerKey: string) {
  return String(viewerKey || "")
    .trim()
    .toLowerCase();
}

export function buildHomeScopeKey(viewerKey: string) {
  return `${LAST_HOME_SCOPE_PREFIX}${normalizeViewerKey(viewerKey)}`;
}

export function buildLandingAffinityKey(viewerKey: string) {
  return `${LANDING_AFFINITY_PREFIX}${normalizeViewerKey(viewerKey)}`;
}

export function buildProfileTabKey(viewerKey: string) {
  return `${LAST_PROFILE_TAB_PREFIX}${normalizeViewerKey(viewerKey)}`;
}

export function buildSearchScopeKey(viewerKey: string) {
  return `${LAST_SEARCH_SCOPE_PREFIX}${normalizeViewerKey(viewerKey)}`;
}

export function normalizeWarmupPreferenceText(value: unknown, maxLength: number) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function createEmptyPersistedWarmupPreferences(): PersistedWarmupPreferences {
  return {
    landingAffinity: null,
    lastHomeScope: null,
    lastProfileTab: null,
    lastSearchScope: null,
  };
}

export function readCachedWarmupPreferences(viewerKey: string) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  if (!normalizedViewerKey) {
    return createEmptyPersistedWarmupPreferences();
  }
  return (
    warmupPreferencesMemoryCache.get(normalizedViewerKey) || createEmptyPersistedWarmupPreferences()
  );
}

export function hasCachedWarmupPreferences(viewerKey: string) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  if (!normalizedViewerKey) return false;
  return warmupPreferencesMemoryCache.has(normalizedViewerKey);
}

export function writeCachedWarmupPreferences(
  viewerKey: string,
  nextPreferences: PersistedWarmupPreferences,
) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  if (!normalizedViewerKey) return;
  warmupPreferencesMemoryCache.set(normalizedViewerKey, nextPreferences);
}

export function mergeCachedWarmupPreferences(
  viewerKey: string,
  nextPartial: Partial<PersistedWarmupPreferences>,
) {
  writeCachedWarmupPreferences(viewerKey, {
    ...readCachedWarmupPreferences(viewerKey),
    ...nextPartial,
  });
}

export function deleteCachedWarmupPreferences(viewerKey: string) {
  const normalizedViewerKey = normalizeViewerKey(viewerKey);
  if (!normalizedViewerKey) return;
  warmupPreferencesMemoryCache.delete(normalizedViewerKey);
}

export function clearCachedWarmupPreferences() {
  warmupPreferencesMemoryCache.clear();
}

export function parseHomeScope(value: string | null | undefined): PersistedHomeWarmupScope | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PersistedHomeWarmupScope> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const sourceFilter =
      parsed.sourceFilter === "following" || parsed.sourceFilter === "own"
        ? parsed.sourceFilter
        : "all";
    const typeFilter =
      parsed.typeFilter === "events" || parsed.typeFilter === "albums" ? parsed.typeFilter : "all";
    const entityFilter =
      parsed.entityFilter === "clubs" || parsed.entityFilter === "students"
        ? parsed.entityFilter
        : "all";
    const sortOption = parsed.sortOption === "oldest" ? "oldest" : "newest";
    const scope =
      normalizeWarmupPreferenceText(parsed.scope, 120) ||
      `${sourceFilter}:${typeFilter}:${entityFilter}:${sortOption}`;
    return {
      entityFilter,
      scope,
      sortOption,
      sourceFilter,
      typeFilter,
      updatedAt: normalizeWarmupPreferenceText(parsed.updatedAt, 80) || new Date(0).toISOString(),
    };
  } catch (error) {
    debugWarn("PROJECTIONS/WARMUP", "parse-home-scope-failed", {
      message: String((error as { message?: string } | null)?.message || "parse-home-scope-failed"),
      value,
    });
    return null;
  }
}

export function parseProfileTab(value: string | null | undefined): ProfileContentTab | null {
  return value === "album" || value === "events" ? value : null;
}

export function parseSearchScope(
  value: string | null | undefined,
): PersistedSearchWarmupScope | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PersistedSearchWarmupScope> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      parsed.kind !== "albums" &&
      parsed.kind !== "events" &&
      parsed.kind !== "clubs" &&
      parsed.kind !== "students"
    ) {
      return null;
    }
    const scope = normalizeWarmupPreferenceText(parsed.scope, 240);
    if (!scope) return null;
    return {
      categoryFilter: normalizeWarmupPreferenceText(parsed.categoryFilter, 40),
      feeFilter: parsed.feeFilter === "free" || parsed.feeFilter === "paid" ? parsed.feeFilter : "",
      kind: parsed.kind,
      queryText: normalizeWarmupPreferenceText(parsed.queryText, 80),
      scope,
      sortMode: normalizeWarmupPreferenceText(parsed.sortMode, 20) || "newest",
      universityFilter: normalizeWarmupPreferenceText(parsed.universityFilter, 40),
      updatedAt: normalizeWarmupPreferenceText(parsed.updatedAt, 80) || new Date(0).toISOString(),
    };
  } catch (error) {
    debugWarn("PROJECTIONS/WARMUP", "parse-search-scope-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "parse-search-scope-failed",
      ),
      value,
    });
    return null;
  }
}

export function buildPersistedHomeScope(params: {
  entityFilter?: HomeProjectionParams["entityFilter"];
  scope: string;
  sortOption?: HomeProjectionParams["sortOption"];
  sourceFilter?: HomeProjectionParams["sourceFilter"];
  typeFilter?: HomeProjectionParams["typeFilter"];
}): PersistedHomeWarmupScope | null {
  const normalizedScope = normalizeWarmupPreferenceText(params.scope, 120);
  if (!normalizedScope) return null;
  return {
    entityFilter:
      params.entityFilter === "clubs" || params.entityFilter === "students"
        ? params.entityFilter
        : "all",
    scope: normalizedScope,
    sortOption: params.sortOption === "oldest" ? "oldest" : "newest",
    sourceFilter:
      params.sourceFilter === "following" || params.sourceFilter === "own"
        ? params.sourceFilter
        : "all",
    typeFilter:
      params.typeFilter === "events" || params.typeFilter === "albums" ? params.typeFilter : "all",
    updatedAt: new Date().toISOString(),
  };
}

export function buildPersistedSearchScope(params: {
  categoryFilter?: string;
  feeFilter?: SearchProjectionParams["feeFilter"];
  kind: SearchProjectionParams["kind"];
  queryText?: string;
  scope: string;
  sortMode?: string;
  universityFilter?: string;
}): PersistedSearchWarmupScope | null {
  const normalizedScope = normalizeWarmupPreferenceText(params.scope, 240);
  if (!normalizedScope) return null;
  return {
    categoryFilter: normalizeWarmupPreferenceText(params.categoryFilter, 40),
    feeFilter: params.feeFilter === "free" || params.feeFilter === "paid" ? params.feeFilter : "",
    kind: params.kind,
    queryText: normalizeWarmupPreferenceText(params.queryText, 80),
    scope: normalizedScope,
    sortMode: normalizeWarmupPreferenceText(params.sortMode, 20) || "newest",
    universityFilter: normalizeWarmupPreferenceText(params.universityFilter, 40),
    updatedAt: new Date().toISOString(),
  };
}
