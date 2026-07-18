jest.mock("../auth", () => ({
  AuthAPI: {
    getMe: jest.fn(),
  },
}));

jest.mock("../projections/projections.api.helpers", () => ({
  tryProjectionRpc: jest.fn(),
}));

jest.mock("../social", () => ({
  FollowAPI: {
    getStatus: jest.fn(),
  },
}));

jest.mock("./profileLookup", () => ({
  getProfileCapabilities: jest.fn(),
}));

jest.mock("./profileMetrics", () => ({
  loadProfileMetrics: jest.fn(),
}));

jest.mock("./profiles.api", () => ({
  ProfileAPI: {
    getByUsername: jest.fn(),
  },
}));

import { AuthAPI } from "../auth";
import { tryProjectionRpc } from "../projections/projections.api.helpers";
import { FollowAPI } from "../social";
import { getProfileCapabilities } from "./profileLookup";
import { loadProfileMetrics } from "./profileMetrics";
import { getProfileOverviewProjection } from "./profileOverviewProjection";
import { ProfileAPI } from "./profiles.api";

describe("getProfileOverviewProjection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tryProjectionRpc as jest.Mock).mockResolvedValue(null);
    (getProfileCapabilities as jest.Mock).mockResolvedValue(null);
  });

  it("requests own profile fallback with metrics enabled", async () => {
    (AuthAPI.getMe as jest.Mock).mockResolvedValue({
      albumsCount: 4,
      eventsCount: 2,
      followersCount: 6,
      followingCount: 3,
      id: "viewer-1",
      username: "cyn",
    });

    await expect(getProfileOverviewProjection("cyn", "cyn", "viewer-1")).resolves.toMatchObject({
      followStatus: "none",
      profile: expect.objectContaining({
        albumsCount: 4,
        eventsCount: 2,
        followersCount: 6,
        followingCount: 3,
        id: "viewer-1",
      }),
    });

    expect(AuthAPI.getMe).toHaveBeenCalledWith({
      allowHardSignOut: false,
      includeMetrics: true,
      recoverSessionOnUnauthorized: false,
    });
    expect(loadProfileMetrics).not.toHaveBeenCalled();
  });

  it("hydrates viewed profile counts from fresh metrics during fallback reads", async () => {
    (ProfileAPI.getByUsername as jest.Mock).mockResolvedValue({
      albumsCount: 0,
      eventsCount: 0,
      followersCount: 0,
      followingCount: 0,
      id: "club-1",
      username: "club-a",
    });
    (FollowAPI.getStatus as jest.Mock).mockResolvedValue({ status: "following" });
    (loadProfileMetrics as jest.Mock).mockResolvedValue({
      albumsCount: 5,
      eventsCount: 7,
      followersCount: 11,
      followingCount: 13,
    });

    await expect(
      getProfileOverviewProjection("club-a", "viewer", "viewer-1"),
    ).resolves.toMatchObject({
      followStatus: "following",
      profile: expect.objectContaining({
        albumsCount: 5,
        eventsCount: 7,
        followersCount: 11,
        followingCount: 13,
        id: "club-1",
      }),
    });

    expect(loadProfileMetrics).toHaveBeenCalledWith("club-1");
  });

  it("returns a blocked marker when the overview projection denies header access", async () => {
    (tryProjectionRpc as jest.Mock).mockResolvedValue({
      items: [
        {
          capabilities: {
            canViewHeader: false,
            lockedReasonCode: "BLOCKED",
          },
          profile: {
            id: "blocked-1",
            username: "blocked-user",
          },
        },
      ],
    });

    await expect(
      getProfileOverviewProjection("blocked-user", "viewer", "viewer-1"),
    ).rejects.toThrow("PROFILE_BLOCKED");
  });
});
