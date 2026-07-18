import { buildSettingsSections } from "./settingsScreen.shared";

describe("buildSettingsSections", () => {
  it("includes privacy only for non-club accounts", () => {
    const studentSections = buildSettingsSections({
      accountType: "student",
      blockedUsersCount: 2,
    });
    const clubSections = buildSettingsSections({
      accountType: "club",
      blockedUsersCount: 0,
    });

    expect(studentSections[0].items.map((item) => item.key)).toEqual([
      "edit-profile",
      "privacy",
      "change-password",
      "blocked-users",
    ]);
    expect(clubSections[0].items.map((item) => item.key)).toEqual([
      "edit-profile",
      "change-password",
      "blocked-users",
    ]);
  });

  it("formats the blocked users subtitle with count when present", () => {
    const sections = buildSettingsSections({
      accountType: "student",
      blockedUsersCount: 3,
    });

    expect(sections[0].items.find((item) => item.key === "blocked-users")).toMatchObject({
      subtitle: "Engellediğin hesaplar (3)",
    });
  });
});
