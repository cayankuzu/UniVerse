type SupabaseProfileMock = {
  from: jest.Mock;
};

export function mockProfileAccountType(
  supabase: SupabaseProfileMock,
  accountType: "club" | "student" = "student",
) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: { account_type: accountType },
    error: null,
  });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  supabase.from.mockReturnValue({ select });
  return { eq, maybeSingle, select };
}
