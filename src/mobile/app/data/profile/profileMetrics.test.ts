jest.mock("../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("./profileLookup", () => ({
  getProfileSummary: jest.fn(),
}));

import { loadProfileMetrics } from "./profileMetrics";

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    from: jest.Mock;
  };
};

const { getProfileSummary } = jest.requireMock("./profileLookup") as {
  getProfileSummary: jest.Mock;
};

describe("loadProfileMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers canonical profile summary counts when available", async () => {
    getProfileSummary.mockResolvedValue({
      albums_count: 4,
      events_count: 3,
      followers_count: 8,
      following_count: 2,
    });

    await expect(loadProfileMetrics("user-1")).resolves.toEqual({
      albumsCount: 4,
      eventsCount: 3,
      followersCount: 8,
      followingCount: 2,
    });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("falls back to direct table counts when canonical summary is unavailable", async () => {
    getProfileSummary.mockResolvedValue(null);
    const profileMaybeSingle = jest.fn().mockResolvedValue({
      data: { account_type: "student" },
    });
    const profileEq = jest.fn(() => ({ maybeSingle: profileMaybeSingle }));
    const profileSelect = jest.fn(() => ({ eq: profileEq }));
    const attendeesIs = jest.fn().mockResolvedValue({ count: 5 });
    const attendeesEq = jest.fn(() => ({ is: attendeesIs }));
    const attendeesSelect = jest.fn(() => ({ eq: attendeesEq }));
    const albumsIs = jest.fn().mockResolvedValue({ count: 2 });
    const albumsEq = jest.fn(() => ({ is: albumsIs }));
    const albumsSelect = jest.fn(() => ({ eq: albumsEq }));
    const followersIs = jest.fn().mockResolvedValue({ count: 11 });
    const followersEqStatus = jest.fn(() => ({ is: followersIs }));
    const followersEqFollowing = jest.fn(() => ({ eq: followersEqStatus }));
    const followersSelect = jest.fn(() => ({ eq: followersEqFollowing }));
    const followingIs = jest.fn().mockResolvedValue({ count: 7 });
    const followingEqStatus = jest.fn(() => ({ is: followingIs }));
    const followingEqFollower = jest.fn(() => ({ eq: followingEqStatus }));
    const followingSelect = jest.fn(() => ({ eq: followingEqFollower }));

    supabase.from
      .mockReturnValueOnce({ select: profileSelect })
      .mockReturnValueOnce({ select: followersSelect })
      .mockReturnValueOnce({ select: followingSelect })
      .mockReturnValueOnce({ select: attendeesSelect })
      .mockReturnValueOnce({ select: albumsSelect });

    await expect(loadProfileMetrics("user-2")).resolves.toEqual({
      albumsCount: 2,
      eventsCount: 5,
      followersCount: 11,
      followingCount: 7,
    });
  });
});
