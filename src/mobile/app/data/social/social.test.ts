import { BlockAPI, FollowAPI } from "./index";

jest.mock("../../platform/observability", () => ({
  startObservedTimer: jest.fn(() => jest.fn()),
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("./social.status", () => ({
  readCanonicalFollowStatus: jest.fn(),
}));

jest.mock("../profile/profileLookup", () => ({
  resolveProfileIdByUsername: jest.fn(),
}));

jest.mock("../profile/profileDisplay", () => ({
  toDisplayName: jest.fn(() => "Test User"),
}));

jest.mock("../../shared/utils/dateTime", () => ({
  timeAgo: jest.fn(() => "simdi"),
}));

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    auth: {
      getUser: jest.Mock;
    };
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

const { readCanonicalFollowStatus } = jest.requireMock("./social.status") as {
  readCanonicalFollowStatus: jest.Mock;
};

const { resolveProfileIdByUsername } = jest.requireMock("../profile/profileLookup") as {
  resolveProfileIdByUsername: jest.Mock;
};

function createFollowDeleteMock(error: unknown = null) {
  const eqFollowing = jest.fn().mockResolvedValue({ error });
  const eqFollower = jest.fn(() => ({ eq: eqFollowing }));
  const remove = jest.fn(() => ({ eq: eqFollower }));
  return {
    chain: { delete: remove },
    eqFollower,
    eqFollowing,
    remove,
  };
}

function createIncomingFollowStatusReadMock(result: unknown) {
  const limit = jest.fn().mockResolvedValue(result);
  const orderId = jest.fn(() => ({ limit }));
  const orderCreated = jest.fn(() => ({ order: orderId, limit }));
  const isDeleted = jest.fn(() => ({ order: orderCreated, limit }));
  const eqFollowing = jest.fn(() => ({ is: isDeleted }));
  const eqFollower = jest.fn(() => ({ eq: eqFollowing }));
  const select = jest.fn(() => ({ eq: eqFollower }));
  return {
    chain: { select },
    select,
  };
}

function createFollowRequestNotificationReadMock(result: unknown) {
  const limit = jest.fn().mockResolvedValue(result);
  const orderId = jest.fn(() => ({ limit }));
  const orderCreated = jest.fn(() => ({ order: orderId, limit }));
  const orderLastActivity = jest.fn(() => ({ order: orderCreated, limit }));
  const isDeleted = jest.fn(() => ({ order: orderLastActivity, limit }));
  const eqType = jest.fn(() => ({ is: isDeleted }));
  const eqActor = jest.fn(() => ({ eq: eqType }));
  const eqUser = jest.fn(() => ({ eq: eqActor }));
  const select = jest.fn(() => ({ eq: eqUser }));
  return {
    chain: { select },
    select,
  };
}

function createFollowAcceptDirectUpdateMock(result: unknown) {
  const limit = jest.fn().mockResolvedValue(result);
  const select = jest.fn(() => ({ limit }));
  const isDeleted = jest.fn(() => ({ select }));
  const eqStatus = jest.fn(() => ({ is: isDeleted }));
  const eqFollowing = jest.fn(() => ({ eq: eqStatus }));
  const eqFollower = jest.fn(() => ({ eq: eqFollowing }));
  const update = jest.fn(() => ({ eq: eqFollower }));
  return {
    chain: { update },
    update,
  };
}

function createNotificationReadAndResolutionMock(readResult: unknown, updateResult: unknown) {
  const limit = jest.fn().mockResolvedValue(readResult);
  const orderId = jest.fn(() => ({ limit }));
  const orderCreated = jest.fn(() => ({ order: orderId, limit }));
  const orderLastActivity = jest.fn(() => ({ order: orderCreated, limit }));
  const isDeletedRead = jest.fn(() => ({ order: orderLastActivity, limit }));
  const eqTypeRead = jest.fn(() => ({ is: isDeletedRead }));
  const eqActorRead = jest.fn(() => ({ eq: eqTypeRead }));
  const eqUserRead = jest.fn(() => ({ eq: eqActorRead }));
  const select = jest.fn(() => ({ eq: eqUserRead }));

  const eqUserUpdate = jest.fn().mockResolvedValue(updateResult);
  const eqIdUpdate = jest.fn(() => ({ eq: eqUserUpdate }));
  const update = jest.fn(() => ({ eq: eqIdUpdate }));

  return {
    chain: { select, update },
    select,
    update,
  };
}

describe("social mutation rpc fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
    });
    resolveProfileIdByUsername.mockResolvedValue("target-id");
  });

  it("falls back to the base follow rpc when the patch wrapper fails", async () => {
    readCanonicalFollowStatus
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "none" });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "toggle_follow_with_patch") {
        return { data: null, error: { message: "patch-failed" } };
      }
      if (name === "toggle_follow") {
        return { data: [{ status: "none" }], error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.toggle("fanzin", {
        clientMutationId: "follow-toggle:1",
        targetUserId: "target-id",
      }),
    ).resolves.toEqual({ status: "none" });

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "toggle_follow_with_patch", {
      client_mutation_id: "follow-toggle:1",
      target_user_id: "target-id",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "toggle_follow", {
      target_user_id: "target-id",
    });
    expect(readCanonicalFollowStatus).toHaveBeenCalledTimes(3);
  });

  it("does not run the base toggle twice when the patch wrapper already changed follow state", async () => {
    readCanonicalFollowStatus
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "none" })
      .mockResolvedValueOnce({ status: "none" });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "toggle_follow_with_patch") {
        return { data: null, error: { message: "post-write-failed" } };
      }
      if (name === "toggle_follow") {
        return { data: [{ status: "requested" }], error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.toggle("fanzin", {
        clientMutationId: "follow-toggle:2",
        targetUserId: "target-id",
      }),
    ).resolves.toEqual({ status: "none" });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("toggle_follow_with_patch", {
      client_mutation_id: "follow-toggle:2",
      target_user_id: "target-id",
    });
  });

  it("verifies queued explicit unfollows against the canonical follow state", async () => {
    readCanonicalFollowStatus.mockResolvedValueOnce({ status: "none" });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "set_follow_status_with_patch") {
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.toggle("fanzin", {
        clientMutationId: "follow-toggle:explicit-1",
        desiredStatus: "none",
        previousStatusHint: "following",
        targetUserId: "target-id",
      }),
    ).resolves.toEqual({ status: "none" });

    expect(supabase.rpc).toHaveBeenCalledWith("set_follow_status_with_patch", {
      client_mutation_id: "follow-toggle:explicit-1",
      desired_status: "none",
      target_user_id: "target-id",
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(readCanonicalFollowStatus).toHaveBeenCalledTimes(1);
  });

  it("does not fall back to the base explicit rpc when the wrapper already reached the desired status", async () => {
    readCanonicalFollowStatus
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "none" })
      .mockResolvedValueOnce({ status: "none" });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "set_follow_status_with_patch") {
        return { data: null, error: { message: "post-write-failed" } };
      }
      if (name === "set_follow_status") {
        return { data: [{ status: "none" }], error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.toggle("fanzin", {
        clientMutationId: "follow-toggle:explicit-2",
        desiredStatus: "none",
        targetUserId: "target-id",
      }),
    ).resolves.toEqual({ status: "none" });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("set_follow_status_with_patch", {
      client_mutation_id: "follow-toggle:explicit-2",
      desired_status: "none",
      target_user_id: "target-id",
    });
  });

  it("uses the legacy toggle path as a compatibility fallback when the explicit rpc is unavailable", async () => {
    readCanonicalFollowStatus
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "none" });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "set_follow_status_with_patch" || name === "set_follow_status") {
        return { data: null, error: { message: "function-not-found" } };
      }
      if (name === "toggle_follow_with_patch") {
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.toggle("fanzin", {
        clientMutationId: "follow-toggle:explicit-compat",
        desiredStatus: "none",
        targetUserId: "target-id",
      }),
    ).resolves.toEqual({ status: "none" });

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, "set_follow_status_with_patch", {
      client_mutation_id: "follow-toggle:explicit-compat",
      desired_status: "none",
      target_user_id: "target-id",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, "set_follow_status", {
      desired_status: "none",
      target_user_id: "target-id",
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(3, "toggle_follow_with_patch", {
      client_mutation_id: "follow-toggle:explicit-compat",
      target_user_id: "target-id",
    });
  });

  it("reconciles follow deletion directly when the rpc result stays stale", async () => {
    const deleteMock = createFollowDeleteMock();
    supabase.from.mockReturnValue(deleteMock.chain);
    readCanonicalFollowStatus
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "following" })
      .mockResolvedValueOnce({ status: "none" });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "set_follow_status_with_patch") {
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.toggle("fanzin", {
        clientMutationId: "follow-toggle:reconcile-1",
        desiredStatus: "none",
        targetUserId: "target-id",
      }),
    ).resolves.toEqual({ status: "none" });

    expect(supabase.from).toHaveBeenCalledWith("follows");
    expect(deleteMock.remove).toHaveBeenCalledTimes(1);
    expect(deleteMock.eqFollower).toHaveBeenCalledWith("follower_id", "viewer-id");
    expect(deleteMock.eqFollowing).toHaveBeenCalledWith("following_id", "target-id");
  });

  it("recovers block state by verifying the table instead of rerunning the rpc", async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { blocked_id: "target-id" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const eqBlocked = jest.fn(() => ({ maybeSingle }));
    const eqBlocker = jest.fn(() => ({ eq: eqBlocked }));
    const select = jest.fn(() => ({ eq: eqBlocker }));
    supabase.from.mockReturnValue({ select });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "block_user_with_patch") {
        return { data: null, error: { message: "patch-failed" } };
      }
      return { data: null, error: null };
    });

    await expect(
      BlockAPI.toggle("fanzin", {
        clientMutationId: "block-toggle:1",
      }),
    ).resolves.toEqual({ blocked: true });

    expect(supabase.rpc).toHaveBeenCalledWith("block_user_with_patch", {
      client_mutation_id: "block-toggle:1",
      target_username: "fanzin",
    });
    expect(
      supabase.rpc.mock.calls.filter(([name]) => name === "viewer_blocked_snapshot"),
    ).toHaveLength(2);
  });

  it("treats an accepted follow request as successful without rerunning the base rpc", async () => {
    const followDirectUpdate = createFollowAcceptDirectUpdateMock({
      data: [],
      error: null,
    });
    const followRead = createIncomingFollowStatusReadMock({
      data: [{ status: "accepted" }],
      error: null,
    });
    let followCallCount = 0;
    supabase.from.mockImplementation((table: string) => {
      if (table === "follows") {
        followCallCount += 1;
        return followCallCount === 1
          ? { ...followDirectUpdate.chain, ...followRead.chain }
          : followRead.chain;
      }
      return { select: jest.fn() };
    });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "respond_follow_request_with_patch") {
        return { data: null, error: { message: "post-write-failed" } };
      }
      if (name === "respond_follow_request") {
        return { data: [{ status: "following" }], error: null };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.acceptRequest("fanzin", {
        clientMutationId: "follow-request:accept-1",
        requesterIdHint: "target-id",
      }),
    ).resolves.toEqual({ success: true });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("respond_follow_request_with_patch", {
      action: "accept",
      client_mutation_id: "follow-request:accept-1",
      requester_id: "target-id",
    });
  });

  it("treats a rejected follow request notification as a successful reject", async () => {
    const followRead = createIncomingFollowStatusReadMock({
      data: [],
      error: null,
    });
    const notificationRead = createFollowRequestNotificationReadMock({
      data: [{ request_status: "rejected" }],
      error: null,
    });
    supabase.from.mockImplementation((table: string) => {
      if (table === "follows") {
        return followRead.chain;
      }
      if (table === "notifications") {
        return notificationRead.chain;
      }
      return { select: jest.fn() };
    });
    supabase.rpc.mockImplementation(async (name: string) => {
      if (name === "respond_follow_request_with_patch") {
        return { data: null, error: { message: "post-write-failed" } };
      }
      if (name === "respond_follow_request") {
        return { data: null, error: { message: "already-processed" } };
      }
      return { data: null, error: null };
    });

    await expect(
      FollowAPI.rejectRequest("fanzin", {
        clientMutationId: "follow-request:reject-1",
        requesterIdHint: "target-id",
      }),
    ).resolves.toEqual({ success: true });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("respond_follow_request_with_patch", {
      action: "reject",
      client_mutation_id: "follow-request:reject-1",
      requester_id: "target-id",
    });
  });

  it("accepts a follow request directly before invoking rpc paths when a pending row is writable", async () => {
    const followDirectUpdate = createFollowAcceptDirectUpdateMock({
      data: [{ id: "follow-row-1" }],
      error: null,
    });
    const notificationStore = createNotificationReadAndResolutionMock(
      {
        data: [],
        error: null,
      },
      {
        data: [{ id: "notif-1" }],
        error: null,
      },
    );

    supabase.from.mockImplementation((table: string) => {
      if (table === "follows") {
        return followDirectUpdate.chain;
      }
      if (table === "notifications") {
        return notificationStore.chain;
      }
      return { select: jest.fn() };
    });

    await expect(
      FollowAPI.acceptRequest("fanzin", {
        clientMutationId: "follow-request:accept-direct-1",
        notificationIdHint: "notif-1",
        requesterIdHint: "target-id",
      }),
    ).resolves.toEqual({ success: true });

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(followDirectUpdate.update).toHaveBeenCalledTimes(1);
    expect(notificationStore.update).toHaveBeenCalledTimes(1);
  });
});
