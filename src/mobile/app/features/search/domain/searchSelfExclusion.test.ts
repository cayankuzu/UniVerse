import { isOwnSearchAlbum, isOwnSearchEvent, isOwnSearchUser } from "./searchSelfExclusion";

describe("search self exclusion", () => {
  const viewer = {
    userId: "viewer-1",
    username: "cyn",
  };

  it("hides the viewer's own event cards", () => {
    expect(
      isOwnSearchEvent(
        {
          clubUserId: "viewer-1",
          clubUsername: "another-name",
        } as any,
        viewer,
      ),
    ).toBe(true);
    expect(
      isOwnSearchEvent(
        {
          clubUserId: "club-2",
          clubUsername: "cyn",
        } as any,
        viewer,
      ),
    ).toBe(true);
    expect(
      isOwnSearchEvent(
        {
          clubUserId: "club-2",
          clubUsername: "other-club",
        } as any,
        viewer,
      ),
    ).toBe(false);
  });

  it("hides the viewer's own album cards", () => {
    expect(
      isOwnSearchAlbum(
        {
          userId: "viewer-1",
          username: "other-user",
        } as any,
        viewer,
      ),
    ).toBe(true);
    expect(
      isOwnSearchAlbum(
        {
          userId: "student-2",
          username: "cyn",
        } as any,
        viewer,
      ),
    ).toBe(true);
    expect(
      isOwnSearchAlbum(
        {
          userId: "student-2",
          username: "other-user",
        } as any,
        viewer,
      ),
    ).toBe(false);
  });

  it("hides the viewer's own user cards", () => {
    expect(
      isOwnSearchUser(
        {
          id: "viewer-1",
          username: "someone-else",
        } as any,
        viewer,
      ),
    ).toBe(true);
    expect(
      isOwnSearchUser(
        {
          id: "student-2",
          username: "cyn",
        } as any,
        viewer,
      ),
    ).toBe(true);
    expect(
      isOwnSearchUser(
        {
          id: "student-2",
          username: "other-user",
        } as any,
        viewer,
      ),
    ).toBe(false);
  });
});
