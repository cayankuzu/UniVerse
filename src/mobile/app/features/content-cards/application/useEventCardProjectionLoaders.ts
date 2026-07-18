import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CommentItem, SearchUserResult } from "../../../data/contracts/api";
import { projectionKeys } from "../../../data/projections";
import { debugWarn } from "../../../platform/logging/logger";
import { fetchEventAttendees, fetchEventComments, fetchEventLikers } from "../data";
import { startObservedTimer } from "../../../platform/observability";
import { readProjectionListCache, writeProjectionListCache } from "./projectionListCache";

export function useEventCardProjectionLoaders(params: {
  bodyActionsEnabled: boolean;
  commentsLoaded: boolean;
  eventActionAccess: {
    attendeesReason?: string | null;
    canViewAttendees: boolean;
    reason?: string | null;
  };
  eventId: string;
  interactive: boolean;
  onShowWarning?: (message: string) => void;
  setAttendeesCount?: Dispatch<SetStateAction<number>>;
  setAttendeesList: (rows: SearchUserResult[]) => void;
  setAttendeesLoading: (value: boolean) => void;
  setAttendeesRefreshing: (value: boolean) => void;
  setComments: (rows: CommentItem[]) => void;
  setCommentsLoaded: (value: boolean) => void;
  setCommentsRefreshing: (value: boolean) => void;
  setLikers: (rows: SearchUserResult[]) => void;
  setLikesLoading: (value: boolean) => void;
  setLikesRefreshing: (value: boolean) => void;
  viewerId?: string;
}) {
  const queryClient = useQueryClient();
  const inFlightLoadsRef = useRef(new Map<string, Promise<void>>());

  const runLoadOnce = useCallback(async (key: string, task: () => Promise<void>) => {
    const existing = inFlightLoadsRef.current.get(key);
    if (existing) {
      return existing;
    }
    const promise = task().finally(() => {
      if (inFlightLoadsRef.current.get(key) === promise) {
        inFlightLoadsRef.current.delete(key);
      }
    });
    inFlightLoadsRef.current.set(key, promise);
    return promise;
  }, []);

  const runProjectionListLoad = useCallback(
    async <T>(options: {
      cache?: {
        entity: string;
        screenKey: readonly unknown[];
      };
      fetch: () => Promise<T[]>;
      metricId: string;
      onRows: (rows: T[]) => void;
      pullToRefresh?: boolean;
      setLoading: (value: boolean) => void;
      setRefreshing: (value: boolean) => void;
    }) => {
      const pullToRefresh = options.pullToRefresh ?? false;
      const cachedSnapshot = options.cache
        ? readProjectionListCache<T>({
            entity: options.cache.entity,
            queryClient,
            screenKey: options.cache.screenKey,
          })
        : { hasSnapshot: false, items: [] as T[] };
      if (!pullToRefresh && cachedSnapshot.hasSnapshot) {
        options.onRows(cachedSnapshot.items);
      }
      const stopTelemetry = startObservedTimer({
        category: "projection",
        meta: {
          cacheHit: !pullToRefresh && cachedSnapshot.hasSnapshot,
          mode: pullToRefresh ? "pull-to-refresh" : "open",
          targetId: params.eventId,
        },
        name: `event_card_modal:${options.metricId}`,
        screenKey: params.eventId,
      });
      const shouldShowBusy = pullToRefresh || !cachedSnapshot.hasSnapshot;
      if (shouldShowBusy) {
        if (pullToRefresh) options.setRefreshing(true);
        else options.setLoading(true);
      }

      try {
        const rows = await options.fetch();
        options.onRows(rows);
        if (options.cache) {
          writeProjectionListCache({
            entity: options.cache.entity,
            items: rows as Array<{ id?: string }>,
            queryClient,
            screenKey: options.cache.screenKey,
          });
        }
        stopTelemetry("ok", { rowCount: rows.length });
      } catch (error) {
        stopTelemetry("error", {
          message: String((error as { message?: string } | null)?.message || error || ""),
        });
        throw error;
      } finally {
        if (shouldShowBusy) {
          if (pullToRefresh) options.setRefreshing(false);
          else options.setLoading(false);
        }
      }
    },
    [params.eventId, queryClient],
  );

  const refreshComments = useCallback(
    async (isPullToRefresh = false) => {
      if (!params.interactive) return;
      await runLoadOnce("comments", async () => {
        const cachedSnapshot = readProjectionListCache<CommentItem>({
          entity: "event-comments",
          queryClient,
          screenKey: projectionKeys.eventComments(params.eventId),
        });
        if (cachedSnapshot.hasSnapshot) {
          params.setComments(cachedSnapshot.items);
          params.setCommentsLoaded(true);
        }
        const shouldShowBusy = isPullToRefresh || !cachedSnapshot.hasSnapshot;
        const stopTelemetry = startObservedTimer({
          category: "projection",
          meta: {
            cacheHit: cachedSnapshot.hasSnapshot,
            mode: isPullToRefresh ? "pull-to-refresh" : "open",
            targetId: params.eventId,
          },
          name: "event_card_modal:comments",
          screenKey: params.eventId,
        });
        if (shouldShowBusy) {
          params.setCommentsRefreshing(true);
        }
        try {
          const data = await fetchEventComments(
            params.eventId,
            { limit: cachedSnapshot.hasSnapshot ? 24 : 16 },
            params.viewerId,
          );
          const nextRows = Array.isArray(data.items) ? data.items : [];
          params.setComments(nextRows);
          params.setCommentsLoaded(true);
          writeProjectionListCache({
            entity: "event-comments",
            items: nextRows,
            queryClient,
            screenKey: projectionKeys.eventComments(params.eventId),
          });
          stopTelemetry("ok", {
            rowCount: nextRows.length,
          });
        } catch (error) {
          debugWarn("CONTENT-CARDS", "event-comments-load-failed", {
            eventId: params.eventId,
            message: String(
              (error as { message?: string } | null)?.message || "event-comments-load-failed",
            ),
          });
          if (!params.commentsLoaded && !isPullToRefresh) params.setCommentsLoaded(true);
          stopTelemetry("rollback", {
            rowCount: 0,
          });
        } finally {
          if (shouldShowBusy) {
            params.setCommentsRefreshing(false);
          }
        }
      });
    },
    [params, queryClient, runLoadOnce],
  );

  const loadLikers = useCallback(
    async (options?: { pullToRefresh?: boolean }) => {
      if (!params.interactive) return;
      await runLoadOnce("likers", async () => {
        await runProjectionListLoad({
          cache: {
            entity: "event-likers",
            screenKey: projectionKeys.eventLikers(params.eventId),
          },
          fetch: async () => {
            const rows = await fetchEventLikers(params.eventId, {}, params.viewerId);
            return Array.isArray(rows.items) ? rows.items : [];
          },
          metricId: "likers",
          onRows: params.setLikers,
          pullToRefresh: options?.pullToRefresh,
          setLoading: params.setLikesLoading,
          setRefreshing: params.setLikesRefreshing,
        });
      });
    },
    [params, runLoadOnce, runProjectionListLoad],
  );

  const loadAttendees = useCallback(
    async (options?: { pullToRefresh?: boolean }) => {
      if (!params.bodyActionsEnabled) return;
      if (!params.eventActionAccess.canViewAttendees) {
        params.onShowWarning?.(
          params.eventActionAccess.attendeesReason ||
            params.eventActionAccess.reason ||
            "Katılımcı listesi bu etkinlik için sınırlı.",
        );
        return;
      }
      await runLoadOnce("attendees", async () => {
        await runProjectionListLoad({
          cache: {
            entity: "event-attendees",
            screenKey: projectionKeys.eventAttendees(params.eventId),
          },
          fetch: async () => {
            const rows = await fetchEventAttendees(params.eventId, {}, params.viewerId);
            return Array.isArray(rows.items) ? rows.items : [];
          },
          metricId: "attendees",
          onRows: (rows) => {
            params.setAttendeesList(rows);
            params.setAttendeesCount?.((current) => Math.max(current, rows.length));
          },
          pullToRefresh: options?.pullToRefresh,
          setLoading: params.setAttendeesLoading,
          setRefreshing: params.setAttendeesRefreshing,
        });
      });
    },
    [params, runLoadOnce, runProjectionListLoad],
  );

  return {
    loadAttendees,
    loadLikers,
    refreshComments,
  };
}
