import {
  createBackpressureWarmupBundle,
  normalizeWarmupBundle,
} from "./projections.warmup.normalize";

describe("warmup bundle normalization", () => {
  it("rejects non-object payloads and normalizes RPC aliases", () => {
    expect(normalizeWarmupBundle(null)).toBeNull();
    const bundle = normalizeWarmupBundle({
      generated_at: "2026-07-20T00:00:00.000Z",
      home_payload: { entities: {}, ids: [] },
      home_scope: "clubs:newest",
      notification_badge: { id: "badge", unread_count: -4 },
    });

    expect(bundle).toEqual(
      expect.objectContaining({
        generatedAt: "2026-07-20T00:00:00.000Z",
        homeScope: "clubs:newest",
        notificationBadge: { id: "badge", unreadCount: 0 },
        source: "rpc",
      }),
    );
  });

  it("creates a projection-first backpressure bundle", () => {
    expect(createBackpressureWarmupBundle("events:newest")).toEqual(
      expect.objectContaining({
        homeScope: "events:newest",
        notificationBadge: { id: "notifications", unreadCount: 0 },
        source: "timeout-backpressure",
      }),
    );
  });
});
