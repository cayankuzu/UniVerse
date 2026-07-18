import { useCallback, useEffect, useMemo, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { applyProjectionEnvelope } from "../../../data/projections";
import type { AuthUserData } from "../../../data/contracts/entities";
import { debugWarn } from "../../../platform/logging/logger";
import {
  getViewerRelationshipSnapshotQueryKey,
  type RelationshipSnapshotProjection,
} from "../../../data/social/relationshipSnapshot";
import { isInteractionActive } from "../../../shared/performance/interactionGate";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";
import { prepareHomeFeedItems } from "../data/homeFeedAdapters";
import { mergeHomeFeedItemsById } from "../data/homeProjectionFallback";
import {
  getHomeProfileSurfaceSupplement,
  type HomeProfileSurfaceFallback,
} from "../data/homeProjectionProfileSurface";
import type { HomeFeedItem } from "../data";
import type { HomeViewerData } from "./homeScreen.types";

type DeferredSupplementHomeProjection = {
  items: HomeFeedItem[];
  loadingMore: boolean;
  query: {
    isFetchedAfterMount: boolean;
    isFetching: boolean;
  };
  screenState?: {
    deltaToken?: string | null;
    nextCursor?: string | null;
    serverTime?: string | null;
    touchedAt?: number;
  } | null;
};

type UseHomeDeferredProfileSupplementParams = {
  allowSecondaryReads: boolean;
  blockedUsers?: string[];
  entityFilter: string;
  filterScope: string;
  homeProjection: DeferredSupplementHomeProjection;
  queryClient: QueryClient;
  queryEntity: string;
  queryKey: readonly unknown[];
  sortOption: "newest" | "oldest";
  sourceFilter: string;
  typeFilter: string;
  userData: AuthUserData;
  userHasInteracted: boolean;
  viewer: HomeViewerData;
  viewerKey: string;
};

export function useHomeDeferredProfileSupplement(params: UseHomeDeferredProfileSupplementParams) {
  const deferredSupplementRef = useRef("");
  const projectionContentSignature = useMemo(() => {
    const itemIds = params.homeProjection.items
      .slice(0, 8)
      .map((item) => String(item.id || "").trim())
      .filter(Boolean);
    return [
      params.filterScope,
      params.homeProjection.items.length,
      itemIds.join("|") || "none",
      params.homeProjection.screenState?.nextCursor || "end",
    ].join(":");
  }, [
    params.filterScope,
    params.homeProjection.items,
    params.homeProjection.screenState?.nextCursor,
  ]);
  const readSeedProfiles = useCallback(() => {
    const snapshot = params.queryClient.getQueryData(
      getViewerRelationshipSnapshotQueryKey({
        viewerId: params.viewer.id,
        viewerUsername: params.viewer.username,
      }),
    ) as RelationshipSnapshotProjection | undefined;

    return (snapshot?.following || []).map<HomeProfileSurfaceFallback>((profile) => ({
      accountType: profile.accountType,
      source: "following",
      username: profile.username,
    }));
  }, [params.queryClient, params.viewer.id, params.viewer.username]);

  useEffect(() => {
    if (
      !params.userData.id ||
      !params.allowSecondaryReads ||
      params.homeProjection.query.isFetching ||
      params.homeProjection.loadingMore
    ) {
      return;
    }

    const supplementKey = [
      params.viewerKey,
      projectionContentSignature,
      params.userHasInteracted ? "interacted" : "passive",
    ].join(":");
    if (
      deferredSupplementRef.current === supplementKey ||
      deferredSupplementRef.current === `pending:${supplementKey}`
    ) {
      return;
    }

    deferredSupplementRef.current = `pending:${supplementKey}`;
    let cancelled = false;
    const task = scheduleAfterInteractions(() => {
      if (isInteractionActive()) {
        deferredSupplementRef.current = "";
        return;
      }
      const seedProfiles = readSeedProfiles();
      void getHomeProfileSurfaceSupplement({
        blockedUsernames: params.blockedUsers,
        entityFilter: params.entityFilter as "all" | "clubs" | "students",
        seedProfiles,
        sortOption: params.sortOption,
        sourceFilter: params.sourceFilter as "all" | "following" | "own",
        typeFilter: params.typeFilter as "all" | "events" | "albums",
        viewerAccountType: params.viewer.accountType,
        viewerId: params.viewer.id,
        viewerUsername: params.viewer.username,
      })
        .then((supplementEnvelope) => {
          if (cancelled) return;
          deferredSupplementRef.current = supplementKey;
          if ((supplementEnvelope.items || []).length === 0) {
            return;
          }
          applyProjectionEnvelope({
            entity: params.queryEntity,
            envelope: {
              deletedIds: [],
              deltaToken:
                params.homeProjection.screenState?.deltaToken ??
                supplementEnvelope.deltaToken ??
                null,
              items: prepareHomeFeedItems(
                mergeHomeFeedItemsById(params.homeProjection.items, supplementEnvelope.items || []),
                params.sortOption,
              ),
              nextCursor:
                params.homeProjection.screenState?.nextCursor ??
                supplementEnvelope.nextCursor ??
                null,
              serverTime:
                params.homeProjection.screenState?.serverTime ??
                supplementEnvelope.serverTime ??
                new Date().toISOString(),
              updatedItems: [],
            },
            mode: "replace",
            queryClient: params.queryClient,
            screenKey: params.queryKey,
          });
        })
        .catch((error) => {
          if (cancelled) return;
          if (deferredSupplementRef.current === `pending:${supplementKey}`) {
            deferredSupplementRef.current = "";
          }
          debugWarn("HOME/SUPPLEMENT", "profile-supplement-load-failed", {
            filterScope: params.filterScope,
            message: String(
              (error as { message?: string } | null)?.message || "profile-supplement-load-failed",
            ),
            supplementKey,
          });
        });
    }, 64);

    return () => {
      cancelled = true;
      task.cancel();
      if (deferredSupplementRef.current === `pending:${supplementKey}`) {
        deferredSupplementRef.current = "";
      }
    };
  }, [
    params.blockedUsers,
    params.allowSecondaryReads,
    params.entityFilter,
    params.filterScope,
    params.homeProjection.items,
    params.homeProjection.loadingMore,
    params.homeProjection.query.isFetching,
    params.homeProjection.screenState?.deltaToken,
    params.homeProjection.screenState?.nextCursor,
    params.homeProjection.screenState?.serverTime,
    projectionContentSignature,
    params.queryClient,
    params.queryEntity,
    params.queryKey,
    readSeedProfiles,
    params.sortOption,
    params.sourceFilter,
    params.typeFilter,
    params.userData.id,
    params.userHasInteracted,
    params.viewer.accountType,
    params.viewer.id,
    params.viewer.username,
    params.viewerKey,
  ]);
}
