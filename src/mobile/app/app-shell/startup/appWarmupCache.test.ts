import { QueryClient } from "@tanstack/react-query";
import { normalizeWarmupBundle } from "../../data/projections/projections.warmup";
import { projectionKeys, readProjectionItems } from "../../data/projections";
import { HOME_WARMUP_SCOPE, seedWarmupBundleIntoCache } from "./appWarmupCache";

function envelope<T>(items: T[]) {
  return {
    deleted_ids: [],
    delta_token: "delta-1",
    items,
    next_cursor: null,
    server_time: "2026-07-20T09:00:00.000Z",
    updated_items: [],
  };
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("startup warmup cache", () => {
  it("normalizes and seeds only the first-fold home data and badge", () => {
    const bundle = normalizeWarmupBundle({
      generated_at: "2026-07-20T09:00:00.000Z",
      home_payload: envelope([
        {
          actor: "club",
          event: {
            id: "event-1",
            title: "Chess Night",
            clubUserId: "club-1",
            createdAt: "2026-07-20T08:00:00.000Z",
            date: "2026-07-20",
          },
          id: "event:event-1",
          kind: "event",
          sort_date: "2026-07-20T08:00:00.000Z",
          source: "following",
        },
      ]),
      notification_badge: { id: "notifications", unread_count: 3 },
    });
    const queryClient = createQueryClient();
    const viewerKey = "viewer-1";

    expect(bundle).not.toBeNull();
    seedWarmupBundleIntoCache({ bundle: bundle!, queryClient, viewerKey });

    expect(
      readProjectionItems(
        queryClient,
        projectionKeys.home(viewerKey, HOME_WARMUP_SCOPE),
        "home-feed",
      ),
    ).toHaveLength(1);
    expect(queryClient.getQueryData(projectionKeys.notificationBadge(viewerKey))).toEqual({
      id: "notifications",
      unreadCount: 3,
    });
  });

  it("does not replace a known badge with timeout placeholder data", () => {
    const queryClient = createQueryClient();
    const viewerKey = "viewer-1";
    queryClient.setQueryData(projectionKeys.notificationBadge(viewerKey), {
      id: "notifications",
      unreadCount: 7,
    });

    seedWarmupBundleIntoCache({
      bundle: {
        generatedAt: "2026-07-20T09:00:00.000Z",
        home: {
          deletedIds: [],
          deltaToken: null,
          items: [],
          nextCursor: null,
          serverTime: "2026-07-20T09:00:00.000Z",
          updatedItems: [],
        },
        homeScope: HOME_WARMUP_SCOPE,
        notificationBadge: { id: "notifications", unreadCount: 0 },
        source: "timeout-backpressure",
      },
      queryClient,
      viewerKey,
    });

    expect(queryClient.getQueryData(projectionKeys.notificationBadge(viewerKey))).toEqual({
      id: "notifications",
      unreadCount: 7,
    });
  });
});
