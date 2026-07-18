import { readCanonicalFollowStatus } from "./social.status";

jest.mock("../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

function createFollowQueryMock(data: unknown, error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data, error });
  const orderId = jest.fn(() => ({ limit }));
  const orderCreatedAt = jest.fn(() => ({ order: orderId }));
  const is = jest.fn(() => ({ order: orderCreatedAt }));
  const eqFollowing = jest.fn(() => ({ is }));
  const eqFollower = jest.fn(() => ({ eq: eqFollowing }));
  const select = jest.fn(() => ({ eq: eqFollower }));

  return {
    chain: { select },
    limit,
    orderCreatedAt,
    orderId,
    select,
  };
}

describe("social canonical follow status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers the latest active follow row when rpc returns a stale requested state", async () => {
    const followQuery = createFollowQueryMock([]);
    supabase.from.mockReturnValue(followQuery.chain);
    supabase.rpc.mockResolvedValue({
      data: [{ status: "requested" }],
      error: null,
    });

    await expect(readCanonicalFollowStatus("fanzin", "viewer-id", "target-id")).resolves.toEqual({
      status: "none",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("get_follow_state", {
      target_user_id: "target-id",
      target_username: "fanzin",
    });
    expect(followQuery.select).toHaveBeenCalledWith("id,status");
    expect(followQuery.orderCreatedAt).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(followQuery.orderId).toHaveBeenCalledWith("id", { ascending: false });
  });

  it("falls back to the latest active row when canonical rpc fails", async () => {
    const followQuery = createFollowQueryMock([{ id: "row-1", status: "accepted" }]);
    supabase.from.mockReturnValue(followQuery.chain);
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "rpc-failed" },
    });

    await expect(readCanonicalFollowStatus("fanzin", "viewer-id", "target-id")).resolves.toEqual({
      status: "following",
    });
  });
});
