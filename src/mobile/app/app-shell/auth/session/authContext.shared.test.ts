import { renderHook } from "@testing-library/react-native";
import { profileToUserData } from "./authContext.shared";
import { useRequiredAuthContext } from "./authContext.shared";

describe("profileToUserData", () => {
  it("forces club profiles to stay public in client auth state", () => {
    expect(
      profileToUserData({
        accountType: "club",
        albumsCount: 0,
        categories: [],
        clubName: "Fanzin",
        coverImage: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        email: "club@example.com",
        eventsCount: 0,
        followersCount: 0,
        followingCount: 0,
        id: "club-id",
        isPrivate: true,
        profileImage: "",
        university: "Test",
        username: "fanzin",
      }).isPrivate,
    ).toBe(false);
  });
});

describe("useRequiredAuthContext", () => {
  it("fails fast when the auth provider is missing", () => {
    expect(() => renderHook(() => useRequiredAuthContext())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});
