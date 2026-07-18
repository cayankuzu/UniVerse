import { BlockAPI } from "./social.block";

jest.mock("../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => jest.fn()),
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../profile/profileLookup", () => ({
  resolveProfileIdByUsername: jest.fn(),
}));

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    auth: {
      getSession: jest.Mock;
      getUser: jest.Mock;
    };
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

const { resolveProfileIdByUsername } = jest.requireMock("../profile/profileLookup") as {
  resolveProfileIdByUsername: jest.Mock;
};

describe("BlockAPI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "viewer-id" },
        },
      },
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
    });
    resolveProfileIdByUsername.mockResolvedValue("target-id");
    supabase.from.mockReturnValue({ select: jest.fn() });
  });

  it("completes block mutations without issuing a redundant follow delete", async () => {
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "block_user_with_patch") {
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      BlockAPI.block("fanzin", {
        clientMutationId: "block-toggle:disconnect",
        targetUserId: "target-id",
      }),
    ).resolves.toEqual({ blocked: true });

    expect(supabase.from).not.toHaveBeenCalledWith("follows");
  });

  it("treats incoming blockers as blocked in the shared block-state read", async () => {
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "viewer_blocked_snapshot") {
        return {
          data: [{ direction: "incoming", user_id: "target-id", username: "fanzin" }],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    await expect(BlockAPI.checkBlocked("fanzin")).resolves.toEqual({ blocked: true });
  });
});
