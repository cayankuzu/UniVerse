import type { ProjectionEnvelope } from "../../../data/query/contracts";
import type { SearchUserResult } from "../../../data/contracts/api";
import { AlbumAPI } from "../../../data/content";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { mergeAlbumCollections } from "../../../data/normalizers/albums";
import { hasAlbumProjectionSurfaceFlags } from "../../../data/normalizers/albums";
import { getViewerRelationshipSnapshot } from "../../../data/social/relationshipSnapshot";
import {
  filterBlockedAlbums,
  filterBlockedEvents,
  filterBlockedSearchUsers,
  loadViewerBlockedVisibilityOrEmpty,
} from "../../../data/social/blockedVisibility";
import { SearchAPI } from "./remote/search";
import {
  clampProjectionLimit,
  resolveProjectionDeltaParams,
  type ProjectionRequestContext,
} from "../../../data/projections/projections.request";
import type {
  SearchProjectionItem,
  SearchProjectionParams,
} from "../../../data/projections/projections.types";
import { hydrateAlbumProjectionEnvelope } from "../../../data/projections/projectionAlbumSurfaceHydration";
import {
  isSearchAlbumVisible,
  isSearchEventVisible,
  isSearchUserVisible,
} from "./searchVisibility";
import {
  mapEnvelopeItems,
  toSearchProjectionItem,
  tryProjectionRpc,
} from "../../../data/projections/projections.api.helpers";

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function loadBlockedVisibilityContext(params: SearchProjectionParams) {
  const viewerId = String(params.viewerId || "").trim();
  if (!viewerId) {
    return loadViewerBlockedVisibilityOrEmpty(viewerId);
  }
  return loadViewerBlockedVisibilityOrEmpty(viewerId, {
    scope: "SEARCH/PROJECTION",
    warningKey: "search-blocked-visibility-load-failed",
  });
}

async function loadSearchVisibilityContext(params: SearchProjectionParams) {
  const viewerUsername = normalize(params.viewerUsername || "");
  const snapshot = await getViewerRelationshipSnapshot({
    viewerId: String(params.viewerId || "").trim(),
    viewerUsername,
  });

  return {
    followingClubUsernames: new Set(snapshot.followingClubUsernames),
    followingUsernames: new Set(snapshot.followingUsernames),
    viewerUsername,
  };
}

function buildSearchProjectionRpcArgs(
  params: SearchProjectionParams,
  queryText: string,
  context: ProjectionRequestContext = {},
) {
  return {
    category_filter: params.categoryFilter || null,
    cursor: context.cursor || null,
    ...resolveProjectionDeltaParams(context),
    fee_filter: params.feeFilter || null,
    kind_name: params.kind,
    limit_count: clampProjectionLimit(context.limit || params.limit, 33),
    query_text: String(queryText || "")
      .trim()
      .slice(0, 80),
    sort_mode: params.sortMode || "newest",
    university_filter: params.universityFilter?.slice(0, 40) || null,
    visibility_filter: null,
    viewer_id: params.viewerId || null,
  };
}

export async function trySearchProjectionEnvelope(
  params: SearchProjectionParams,
  queryText: string,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<SearchProjectionItem> | null> {
  const rpcArgs = buildSearchProjectionRpcArgs(params, queryText, context);
  const rpcEnvelope = context.signal
    ? await tryProjectionRpc<unknown>("search_results_projection_v2", rpcArgs, context.signal)
    : await tryProjectionRpc<unknown>("search_results_projection_v2", rpcArgs);
  if (!rpcEnvelope) return null;
  const idsNeedingHydration = new Set<string>();
  const mappedEnvelope =
    params.kind === "albums"
      ? await hydrateAlbumProjectionEnvelope(
          mapEnvelopeItems(rpcEnvelope, (row) => {
            const item = toSearchProjectionItem(row, params.kind);
            if (item && "id" in item && !hasAlbumProjectionSurfaceFlags(row)) {
              idsNeedingHydration.add(String(item.id || ""));
            }
            return item;
          }) as ProjectionEnvelope<AlbumPhotoWithMeta>,
          idsNeedingHydration,
        )
      : mapEnvelopeItems(rpcEnvelope, (row) => toSearchProjectionItem(row, params.kind));
  const blockedVisibility = await loadBlockedVisibilityContext(params);

  if (params.kind === "events") {
    return {
      ...mappedEnvelope,
      items: filterBlockedEvents(mappedEnvelope.items as EventWithMeta[], blockedVisibility),
      updatedItems: filterBlockedEvents(
        (mappedEnvelope.updatedItems || []) as EventWithMeta[],
        blockedVisibility,
      ),
    };
  }

  if (params.kind === "albums") {
    return {
      ...mappedEnvelope,
      items: filterBlockedAlbums(mappedEnvelope.items as AlbumPhotoWithMeta[], blockedVisibility),
      updatedItems: filterBlockedAlbums(
        (mappedEnvelope.updatedItems || []) as AlbumPhotoWithMeta[],
        blockedVisibility,
      ),
    };
  }

  return {
    ...mappedEnvelope,
    items: filterBlockedSearchUsers(mappedEnvelope.items as SearchUserResult[], blockedVisibility),
    updatedItems: filterBlockedSearchUsers(
      (mappedEnvelope.updatedItems || []) as SearchUserResult[],
      blockedVisibility,
    ),
  };
}

export async function buildAlbumSearchFallbackEnvelope(
  params: SearchProjectionParams,
  queryText: string,
  options: {
    allowLegacySearchApi?: boolean;
    skipSqlSource?: boolean;
  } = {},
): Promise<ProjectionEnvelope<SearchProjectionItem>> {
  if (!options.skipSqlSource) {
    const sqlEnvelope = await trySearchProjectionEnvelope(params, queryText);
    if (sqlEnvelope) return sqlEnvelope;
  }
  const [visibilityContext, blockedVisibility, searchAlbums] = await Promise.all([
    loadSearchVisibilityContext(params),
    loadBlockedVisibilityContext(params),
    AlbumAPI.getSearchFeed(params.limit),
  ]);
  const normalizedQuery = normalize(queryText);
  const excludeFollowedContent = !normalizedQuery;
  const items = filterBlockedAlbums(mergeAlbumCollections(searchAlbums), blockedVisibility)
    .filter((item) => {
      if (
        !isSearchAlbumVisible(item, {
          ...visibilityContext,
          excludeFollowedContent,
        })
      ) {
        return false;
      }
      if (params.universityFilter) {
        const university = normalize(item.userUniversity || "");
        if (university !== normalize(params.universityFilter)) return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        item.title,
        item.caption,
        item.eventTitle,
        item.name,
        item.username,
        item.clubName,
        item.clubUsername,
        item.userUniversity,
      ]
        .map((value) => normalize(String(value || "")))
        .filter(Boolean)
        .join(" ");
      return haystack.includes(normalizedQuery);
    })
    .sort((a, b) => {
      const aTime = new Date(String(a.createdAt || "")).getTime();
      const bTime = new Date(String(b.createdAt || "")).getTime();
      return (params.sortMode || "newest") === "oldest" ? aTime - bTime : bTime - aTime;
    })
    .slice(0, Math.max(1, Math.min(Number(params.limit || 20), 50)));

  const serverTime = new Date().toISOString();
  return {
    items,
    nextCursor: null,
    serverTime,
    deltaToken: serverTime,
    updatedItems: [],
    deletedIds: [],
  };
}

function isFreeFeeLabel(value: string) {
  const normalized = normalize(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    !normalized ||
    normalized.includes("Ücretsiz") ||
    normalized.includes("free") ||
    normalized === "0" ||
    normalized === "0 tl"
  );
}

function filterEventsByFee(
  items: SearchProjectionItem[],
  feeFilter: SearchProjectionParams["feeFilter"],
) {
  if (!feeFilter) return items;
  return (items as EventWithMeta[]).filter((item) =>
    feeFilter === "free" ? isFreeFeeLabel(item.fee || "") : !isFreeFeeLabel(item.fee || ""),
  );
}

export async function buildSearchFallbackEnvelope(
  params: SearchProjectionParams,
  queryText: string,
  options: {
    allowLegacySearchApi?: boolean;
    skipSqlSource?: boolean;
  } = {},
): Promise<ProjectionEnvelope<SearchProjectionItem>> {
  if (params.kind === "albums") {
    return buildAlbumSearchFallbackEnvelope(params, queryText, options);
  }

  if (!options.skipSqlSource) {
    const sqlEnvelope = await trySearchProjectionEnvelope(params, queryText);
    if (sqlEnvelope) return sqlEnvelope;
  }

  const rows = await SearchAPI.search(
    queryText,
    params.kind,
    params.universityFilter,
    params.categoryFilter,
    params.limit,
  );
  const [visibilityContext, blockedVisibility] = await Promise.all([
    params.kind === "events" || params.kind === "clubs" || params.kind === "students"
      ? loadSearchVisibilityContext(params)
      : Promise.resolve(null),
    loadBlockedVisibilityContext(params),
  ]);
  const excludeFollowedContent = !normalize(queryText);
  const visibleItems = ((Array.isArray(rows) ? rows : []) as SearchProjectionItem[]).filter(
    (item) =>
      params.kind === "events"
        ? isSearchEventVisible(item as EventWithMeta, {
            ...(visibilityContext || {}),
            excludeFollowedContent,
          })
        : params.kind === "clubs" || params.kind === "students"
          ? isSearchUserVisible(item as { username?: string | null }, {
              ...(visibilityContext || {}),
              excludeFollowedContent,
            })
          : true,
  );
  const blockedFilteredItems =
    params.kind === "events"
      ? filterBlockedEvents(visibleItems as EventWithMeta[], blockedVisibility)
      : params.kind === "clubs" || params.kind === "students"
        ? filterBlockedSearchUsers(visibleItems as SearchUserResult[], blockedVisibility)
        : visibleItems;
  const items = filterEventsByFee(
    blockedFilteredItems,
    params.kind === "events" ? params.feeFilter : "",
  ).slice(0, Math.max(1, Math.min(Number(params.limit || 20), 50)));
  const serverTime = new Date().toISOString();

  return {
    items,
    nextCursor: null,
    serverTime,
    deltaToken: serverTime,
    updatedItems: [],
    deletedIds: [],
  };
}
