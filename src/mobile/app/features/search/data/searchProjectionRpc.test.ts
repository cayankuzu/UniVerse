jest.mock("../../../data/projections/projections.api.helpers", () => ({
  mapEnvelopeItems: (
    envelope: { items?: unknown[]; [key: string]: unknown },
    mapper: (item: unknown) => unknown,
  ) => ({
    ...envelope,
    items: Array.isArray(envelope.items) ? envelope.items.map((item) => mapper(item)) : [],
  }),
  nowEnvelope: (items: unknown[]) => ({
    deletedIds: [],
    deltaToken: "2026-03-18T00:00:00.000Z",
    items,
    nextCursor: null,
    serverTime: "2026-03-18T00:00:00.000Z",
    updatedItems: [],
  }),
  toSearchProjectionItem: (item: unknown) => item,
  tryProjectionRpc: jest.fn(),
}));

jest.mock("../../../data/social/blockedVisibility", () => ({
  filterBlockedAlbums: (items: unknown[]) => items,
  filterBlockedEvents: (items: unknown[]) => items,
  filterBlockedSearchUsers: (items: unknown[]) => items,
  loadViewerBlockedVisibilityOrEmpty: jest.fn().mockResolvedValue({
    blockedIds: new Set(),
    blockedUsernames: new Set(),
    viewerId: "viewer-id",
  }),
}));

jest.mock("../../../data/social/relationshipSnapshot", () => ({
  getViewerRelationshipSnapshot: jest.fn(),
}));

jest.mock("../../../data/content", () => ({
  AlbumAPI: { getFeed: jest.fn() },
}));

const { tryProjectionRpc } = jest.requireMock(
  "../../../data/projections/projections.api.helpers",
) as {
  tryProjectionRpc: jest.Mock;
};

import { trySearchProjectionEnvelope } from "./searchProjectionFallback";

describe("trySearchProjectionEnvelope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the v2 search projection rpc for albums", async () => {
    tryProjectionRpc.mockResolvedValue({
      deletedIds: [],
      deltaToken: "2026-03-18T00:00:00.000Z",
      items: [{ id: "album-v2", username: "uploader" }],
      nextCursor: null,
      serverTime: "2026-03-18T00:00:00.000Z",
      updatedItems: [],
    });

    await trySearchProjectionEnvelope(
      {
        kind: "albums",
        limit: 20,
        queryText: "",
        viewerId: "viewer-id",
      },
      "",
    );

    expect(tryProjectionRpc).toHaveBeenCalledWith(
      "search_results_projection_v2",
      expect.objectContaining({
        kind_name: "albums",
        viewer_id: "viewer-id",
      }),
    );
  });
});
