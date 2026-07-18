import { runObservedSocialMutation } from "./social.helpers";

const mockStopObservedTimer = jest.fn();

jest.mock("../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => mockStopObservedTimer),
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock("../profile/profileLookup", () => ({
  resolveProfileIdByUsername: jest.fn(),
}));

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    auth: {
      getUser: jest.Mock;
    };
  };
};

const { resolveProfileIdByUsername } = jest.requireMock("../profile/profileLookup") as {
  resolveProfileIdByUsername: jest.Mock;
};

describe("runObservedSocialMutation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStopObservedTimer.mockClear();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
    });
    resolveProfileIdByUsername.mockResolvedValue("target-id");
  });

  it("throws when the mutation fails and throwOnFailure is enabled", async () => {
    await expect(
      runObservedSocialMutation({
        fallback: { status: "none" as const },
        mutationName: "toggle-follow",
        run: async () => null,
        telemetryTarget: "follow",
        throwOnFailure: true,
        username: "hedef",
      }),
    ).rejects.toThrow("toggle-follow failed");
  });

  it("returns fallback when throwOnFailure is disabled", async () => {
    await expect(
      runObservedSocialMutation({
        fallback: { status: "none" as const },
        mutationName: "toggle-follow",
        run: async () => null,
        telemetryTarget: "follow",
        username: "hedef",
      }),
    ).resolves.toEqual({ status: "none" });
  });

  it("records the thrown error message in telemetry when the mutation callback throws", async () => {
    await expect(
      runObservedSocialMutation({
        fallback: { status: "none" as const },
        mutationName: "toggle-follow",
        run: async () => {
          throw new Error("rpc exploded");
        },
        telemetryTarget: "follow",
        throwOnFailure: true,
        username: "hedef",
      }),
    ).rejects.toThrow("rpc exploded");

    expect(mockStopObservedTimer).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        message: "rpc exploded",
        source: "mutation-failed",
      }),
    );
  });
});
