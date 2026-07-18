jest.mock("../../platform/config/runtime", () => ({
  RUNTIME_FLAGS: {
    disableLegacyEdgeReads: true,
  },
}));

jest.mock("../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("./profileLookup", () => ({
  getProfileCapabilities: jest.fn(),
  getProfileSummary: jest.fn(),
  resolveProfileIdByUsername: jest.fn(),
}));

jest.mock("./profileMetrics", () => ({
  loadProfileMetrics: jest.fn(),
}));

import { PROFILE_TABLE_SELECT_COLUMNS } from "../normalizers/userProfiles";
import { ProfileAPI } from "./profiles.api";

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

const { loadProfileMetrics } = jest.requireMock("./profileMetrics") as {
  loadProfileMetrics: jest.Mock;
};

const { getProfileSummary, resolveProfileIdByUsername } = jest.requireMock("./profileLookup") as {
  getProfileSummary: jest.Mock;
  resolveProfileIdByUsername: jest.Mock;
};

describe("ProfileAPI.getByUsername", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the canonical profile projection when summary hydration falls back to profiles", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        account_type: "student",
        bio: "Bio",
        categories: ["music"],
        club_name: null,
        cover_image_path: "covers/viewer.jpg",
        created_at: "2024-01-01T00:00:00.000Z",
        department: "CS",
        description: "Desc",
        email: "viewer@example.com",
        grade_year: "4",
        hide_email: false,
        is_private: false,
        name: "Viewer",
        profile_image_path: "avatars/viewer.jpg",
        university: "Test University",
        user_id: "viewer-2",
        username: "viewer",
      },
      error: null,
    });
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ select });
    resolveProfileIdByUsername.mockResolvedValue("viewer-2");
    getProfileSummary.mockResolvedValue(null);
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    loadProfileMetrics.mockResolvedValue({
      albumsCount: 3,
      eventsCount: 4,
      followersCount: 1,
      followingCount: 2,
    });

    await expect(ProfileAPI.getByUsername("Viewer")).resolves.toMatchObject({
      accountType: "student",
      albumsCount: 3,
      email: "viewer@example.com",
      eventsCount: 4,
      followersCount: 1,
      followingCount: 2,
      id: "viewer-2",
      username: "viewer",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("can_view_profile", {
      target_id: "viewer-2",
    });
    expect(select).toHaveBeenCalledWith(PROFILE_TABLE_SELECT_COLUMNS);
    expect(eq).toHaveBeenCalledWith("user_id", "viewer-2");
  });
});
