import { getSeededAuthStateFromSession } from "./authSessionSeed";

describe("auth session seed", () => {
  it("forces club accounts to public even if old metadata says private", () => {
    const seeded = getSeededAuthStateFromSession({
      user: {
        created_at: "2026-03-13T00:00:00.000Z",
        email: "club@example.com",
        id: "club-user-id",
        user_metadata: {
          accountType: "club",
          clubName: "Fanzin",
          isPrivate: true,
          username: "fanzin",
        },
      },
    } as any);

    expect(seeded.accountType).toBe("club");
    expect(seeded.isPrivateAccount).toBe(false);
    expect(seeded.userData.isPrivate).toBe(false);
  });
});
