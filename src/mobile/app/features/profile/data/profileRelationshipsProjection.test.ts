jest.mock("../../../data/projections/projections.api.helpers", () => {
  const actual = jest.requireActual("../../../data/projections/projections.api.helpers");
  return {
    ...actual,
    fetchRelationshipRows: jest.fn(),
    tryProjectionRpc: jest.fn(),
  };
});

jest.mock("../../../data/social/blockedVisibility", () => {
  const actual = jest.requireActual("../../../data/social/blockedVisibility");
  return {
    ...actual,
    loadViewerBlockedVisibility: jest.fn(),
  };
});

import {
  fetchRelationshipRows,
  tryProjectionRpc,
} from "../../../data/projections/projections.api.helpers";
import { loadViewerBlockedVisibility } from "../../../data/social/blockedVisibility";
import { getRelationshipsProjection } from "./profileRelationshipsProjection";

describe("getRelationshipsProjection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("filters blocked users out of rpc relationship rows", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      deletedIds: [],
      deltaToken: "delta-1",
      items: [
        { id: "user-1", name: "Visible", time: "1 dk", username: "visible-user" },
        { id: "user-2", name: "Blocked", time: "1 dk", username: "blocked-user" },
      ],
      nextCursor: null,
      serverTime: "2026-03-29T00:00:00.000Z",
      updatedItems: [],
    });
    (loadViewerBlockedVisibility as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["user-2"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-1",
    });

    const result = await getRelationshipsProjection({
      kind: "followers",
      username: "target-user",
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([
      expect.objectContaining({ id: "user-1", username: "visible-user" }),
    ]);
    expect(loadViewerBlockedVisibility).toHaveBeenCalledWith("viewer-1");
  });

  it("filters blocked users out of fallback relationship rows", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (fetchRelationshipRows as jest.Mock).mockResolvedValue([
      { id: "user-1", name: "Visible", time: "1 dk", username: "visible-user" },
      { id: "user-2", name: "Blocked", time: "1 dk", username: "blocked-user" },
    ]);
    (loadViewerBlockedVisibility as jest.Mock).mockResolvedValue({
      blockedIds: new Set(["user-2"]),
      blockedUsernames: new Set(["blocked-user"]),
      viewerId: "viewer-1",
    });

    const result = await getRelationshipsProjection({
      kind: "following",
      username: "target-user",
      viewerId: "viewer-1",
    });

    expect(result.items).toEqual([
      expect.objectContaining({ id: "user-1", username: "visible-user" }),
    ]);
    expect(fetchRelationshipRows).toHaveBeenCalledWith("target-user", "following");
  });
});
