import { RUNTIME_FLAGS } from "../../../platform/config/runtime";
import type { ProjectionEnvelope } from "../../../data/query/contracts";
import {
  buildSearchFallbackEnvelope,
  trySearchProjectionEnvelope,
} from "./searchProjectionFallback";
import {
  clampProjectionLimit,
  type ProjectionRequestContext,
} from "../../../data/projections/projections.request";
import { shouldFallbackToLegacy } from "../../../data/projections/projections.api.helpers";
import type {
  SearchProjectionItem,
  SearchProjectionParams,
} from "../../../data/projections/projections.types";
import { startObservedTimer } from "../../../platform/observability";

export async function getSearchResults(
  params: SearchProjectionParams,
  context: ProjectionRequestContext = {},
): Promise<ProjectionEnvelope<SearchProjectionItem>> {
  const trimmedQuery = String(params.queryText || "").trim();
  const limit = clampProjectionLimit(context.limit || params.limit, 33);
  const allowLegacySearchApi = shouldFallbackToLegacy();
  const stopTelemetry = startObservedTimer({
    category: "projection",
    meta: {
      hasQuery: Boolean(trimmedQuery),
      kind: params.kind,
      limit,
      scope: context.cursor ? "append" : "initial",
    },
    name: "search_projection_request",
    screenKey: params.kind,
  });
  try {
    const projectionEnvelope = RUNTIME_FLAGS.useProjectionSearch
      ? await trySearchProjectionEnvelope(
          {
            ...params,
            limit,
          },
          trimmedQuery,
          {
            ...context,
            limit,
          },
        )
      : null;
    if (projectionEnvelope) {
      stopTelemetry("ok", {
        itemCount: projectionEnvelope.items.length,
        source: "projection",
      });
      return projectionEnvelope;
    }

    const fallbackEnvelope = await buildSearchFallbackEnvelope(
      {
        ...params,
        limit,
      },
      trimmedQuery,
      {
        allowLegacySearchApi,
        // The projection RPC already missed, so recover from SQL/table sources
        // instead of waiting on the same RPC a second time.
        skipSqlSource: true,
      },
    );
    stopTelemetry("rollback", {
      itemCount: fallbackEnvelope.items.length,
      source: allowLegacySearchApi ? "legacy-fallback" : "sql-table-fallback",
    });
    return fallbackEnvelope;
  } catch (error) {
    stopTelemetry("error", {
      message: String((error as { message?: string } | null)?.message || error || ""),
    });
    throw error;
  }
}
