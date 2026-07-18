import { applyProfileUpdateInTable } from "./authProfileSync";
import { PROFILE_TABLE_SELECT_COLUMNS } from "./auth.shared";

jest.mock("../../platform/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("./authSession.shared", () => ({
  getCurrentAuthUserOrThrow: jest.fn(),
}));

const { supabase } = jest.requireMock("../../platform/supabase") as {
  supabase: {
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

const { getCurrentAuthUserOrThrow } = jest.requireMock("./authSession.shared") as {
  getCurrentAuthUserOrThrow: jest.Mock;
};

describe("applyProfileUpdateInTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers the profile patch RPC before falling back to direct table writes", async () => {
    const getMeFromTable = jest.fn().mockResolvedValue({
      accountType: "student",
      email: "viewer@example.com",
      id: "viewer-1",
      isPrivate: false,
      username: "viewer",
    });
    supabase.rpc.mockResolvedValue({ error: null });

    await expect(
      applyProfileUpdateInTable({ bio: "updated bio" }, getMeFromTable),
    ).resolves.toEqual({
      accountType: "student",
      email: "viewer@example.com",
      id: "viewer-1",
      isPrivate: false,
      username: "viewer",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("update_profile_patch", {
      target_patch: { bio: "updated bio" },
    });
    expect(getMeFromTable).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(getCurrentAuthUserOrThrow).not.toHaveBeenCalled();
  });

  it("uses the canonical profile projection when the patch RPC is unavailable", async () => {
    const getMeFromTable = jest.fn().mockResolvedValue({
      accountType: "student",
      email: "viewer@example.com",
      id: "viewer-1",
      isPrivate: false,
      username: "viewer",
    });
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        account_type: "student",
        bio: "old bio",
        categories: [],
        club_name: null,
        cover_image_path: null,
        created_at: "2024-01-01T00:00:00.000Z",
        department: null,
        description: null,
        email: "viewer@example.com",
        grade_year: null,
        hide_email: false,
        is_private: false,
        name: "Viewer",
        profile_image_path: null,
        university: "Test University",
        user_id: "viewer-1",
        username: "viewer",
      },
      error: null,
    });
    const select = jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle })) }));
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq: updateEq }));
    supabase.from
      .mockImplementationOnce(() => ({ select }))
      .mockImplementationOnce(() => ({ update }));
    supabase.rpc.mockResolvedValue({
      error: {
        message: "Could not find the function public.update_profile_patch in the schema cache",
      },
    });
    getCurrentAuthUserOrThrow.mockResolvedValue({ id: "viewer-1" });

    await expect(
      applyProfileUpdateInTable({ bio: "updated bio" }, getMeFromTable),
    ).resolves.toEqual({
      accountType: "student",
      email: "viewer@example.com",
      id: "viewer-1",
      isPrivate: false,
      username: "viewer",
    });

    expect(select).toHaveBeenCalledWith(PROFILE_TABLE_SELECT_COLUMNS);
    expect(update).toHaveBeenCalledWith({ bio: "updated bio", club_name: null });
    expect(updateEq).toHaveBeenCalledWith("user_id", "viewer-1");
    expect(getMeFromTable).toHaveBeenCalledTimes(1);
  });
});
