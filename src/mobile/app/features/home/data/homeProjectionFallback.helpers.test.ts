import { filterFallbackHomeAlbums } from "./homeProjectionFallback.helpers";

describe("filterFallbackHomeAlbums", () => {
  it("keeps followed student uploads in home", () => {
    const result = filterFallbackHomeAlbums(
      [
        {
          clubUsername: "xy-kulübü",
          eventId: "event-1",
          id: "album-1",
          showOnClubProfile: true,
          username: "takip-edilen-Öğrenci",
        } as any,
      ],
      [
        {
          feedActorType: "student",
          feedActorUsername: "takip-edilen-Öğrenci",
          feedSource: "following_student",
          id: "event-1",
        } as any,
      ],
      "viewer",
    );

    expect(result.map((item) => item.id)).toEqual(["album-1"]);
  });

  it("drops unfollowed student uploads from followed clubs in home", () => {
    const result = filterFallbackHomeAlbums(
      [
        {
          clubUsername: "takip-edilen-kulüp",
          eventId: "event-1",
          id: "album-2",
          showOnClubProfile: true,
          username: "takip-edilmeyen-Öğrenci",
        } as any,
      ],
      [
        {
          feedActorType: "club",
          feedActorUsername: "takip-edilen-kulüp",
          feedSource: "following_club",
          id: "event-1",
        } as any,
      ],
      "viewer",
    );

    expect(result).toEqual([]);
  });
});
