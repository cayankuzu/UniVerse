import { fallbackGetMeFromTable, PROFILE_TABLE_SELECT_COLUMNS } from "./auth.shared";

jest.mock("../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("./authProfileSync", () => ({
  ensureCurrentUserProfileRow: jest.fn(),
}));

jest.mock("./authSession.shared", () => ({
  getCurrentAuthUserOrThrow: jest.fn(),
}));

jest.mock("../profile/profileMetrics", () => ({
  loadProfileMetrics: jest.fn(),
}));

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    from: jest.Mock;
  };
};

const { getCurrentAuthUserOrThrow } = jest.requireMock("./authSession.shared") as {
  getCurrentAuthUserOrThrow: jest.Mock;
};

const { loadProfileMetrics } = jest.requireMock("../profile/profileMetrics") as {
  loadProfileMetrics: jest.Mock;
};

describe("fallbackGetMeFromTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the canonical profile projection for direct table fallbacks", async () => {
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
        user_id: "viewer-1",
        username: "viewer",
      },
      error: null,
    });
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ select });
    getCurrentAuthUserOrThrow.mockResolvedValue({ id: "viewer-1" });
    loadProfileMetrics.mockResolvedValue({
      albumsCount: 3,
      eventsCount: 4,
      followersCount: 1,
      followingCount: 2,
    });

    await expect(fallbackGetMeFromTable()).resolves.toMatchObject({
      accountType: "student",
      albumsCount: 3,
      email: "viewer@example.com",
      eventsCount: 4,
      followersCount: 1,
      followingCount: 2,
      id: "viewer-1",
      username: "viewer",
    });

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith(PROFILE_TABLE_SELECT_COLUMNS);
    expect(eq).toHaveBeenCalledWith("user_id", "viewer-1");
  });
});
