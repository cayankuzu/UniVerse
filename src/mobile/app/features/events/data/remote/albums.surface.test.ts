import {
  buildEventAlbumCardCountMap,
  filterAlbumsBySurfaceContext,
  filterEventAlbumSurfaceForViewer,
  getAlbumSurfaceLabel,
  resolveAlbumSurfaceVisibility,
} from "../../../../data/normalizers/albums";

describe("getAlbumSurfaceLabel", () => {
  it("returns own-only label when the album is only on the uploader profile", () => {
    expect(
      getAlbumSurfaceLabel(
        {
          showOnClubProfile: false,
          showOnOwnProfile: true,
          showOnProfile: true,
        },
        "profile",
      ),
    ).toEqual({ text: "Kendim", type: "own" });
  });

  it("returns club-only label when the album is only on the club surface", () => {
    expect(
      getAlbumSurfaceLabel(
        {
          showOnClubProfile: true,
          showOnOwnProfile: false,
          showOnProfile: true,
        },
        "profile",
      ),
    ).toEqual({ text: "Kulüp", type: "club" });
  });

  it("returns combined label when both surfaces are enabled", () => {
    expect(
      getAlbumSurfaceLabel(
        {
          showOnClubProfile: true,
          showOnOwnProfile: true,
          showOnProfile: true,
        },
        "profile",
      ),
    ).toEqual({ text: "Kendim ve Kulüp", type: "club" });
  });

  it("keeps own-only label on event album surfaces when the club surface is disabled", () => {
    expect(
      getAlbumSurfaceLabel(
        {
          clubUsername: "ieee",
          eventId: "event-1",
          showOnClubProfile: false,
          showOnOwnProfile: true,
          showOnProfile: true,
          username: "cayan",
        } as any,
        "event_album",
      ),
    ).toEqual({ text: "Kendim", type: "own" });
  });

  it("shows combined visibility on event album cards while explicit flags are still hydrating", () => {
    expect(
      getAlbumSurfaceLabel(
        {
          eventId: "event-1",
          showOnProfile: true,
        } as any,
        "event_album",
      ),
    ).toEqual({ text: "Kendim ve Kulüp", type: "club" });
  });

  it("keeps own-only label on profile surfaces when the club surface is disabled", () => {
    expect(
      getAlbumSurfaceLabel(
        {
          clubUsername: "ieee",
          eventId: "event-1",
          showOnClubProfile: false,
          showOnOwnProfile: true,
          showOnProfile: true,
          username: "cayan",
        },
        "profile",
      ),
    ).toEqual({ text: "Kendim", type: "own" });
  });
});

describe("resolveAlbumSurfaceVisibility", () => {
  it("returns a canonical label snapshot for album cards", () => {
    expect(
      resolveAlbumSurfaceVisibility({
        showOnClubProfile: true,
        showOnOwnProfile: false,
        showOnProfile: true,
      } as any),
    ).toEqual({
      label: { text: "Kulüp", type: "club" },
      showOnClubProfile: true,
      showOnOwnProfile: false,
      showOnProfile: true,
    });
  });
});

describe("filterAlbumsBySurfaceContext", () => {
  it("keeps only club-and-own albums on the event album surface", () => {
    expect(
      filterAlbumsBySurfaceContext(
        [
          {
            id: "own-only",
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
          },
          {
            id: "club-only",
            showOnClubProfile: true,
            showOnOwnProfile: false,
            showOnProfile: true,
          },
          {
            id: "club-and-own",
            showOnClubProfile: true,
            showOnOwnProfile: true,
            showOnProfile: true,
          },
        ] as any,
        "event_album",
      ).map((item) => item.id),
    ).toEqual(["club-and-own"]);
  });
});

describe("filterEventAlbumSurfaceForViewer", () => {
  it("keeps only event albums that are visible on both the user and club surfaces", () => {
    expect(
      filterEventAlbumSurfaceForViewer(
        [
          {
            id: "own-only",
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
            userId: "viewer-1",
            username: "viewer",
          },
          {
            id: "club-only",
            showOnClubProfile: true,
            showOnOwnProfile: false,
            showOnProfile: true,
            userId: "student-3",
            username: "student-3",
          },
          {
            id: "club-and-own",
            showOnClubProfile: true,
            showOnOwnProfile: true,
            showOnProfile: true,
            userId: "student-2",
            username: "student-2",
          },
        ] as any,
        { viewerId: "viewer-1", viewerUsername: "viewer" },
      ).map((item) => item.id),
    ).toEqual(["club-and-own"]);
  });

  it("treats missing hydrated event album flags as combined visibility until hydration completes", () => {
    expect(
      filterEventAlbumSurfaceForViewer(
        [
          {
            eventId: "event-1",
            id: "pending-hydration",
            showOnProfile: true,
          },
        ] as any,
        { viewerId: "viewer-1", viewerUsername: "viewer" },
      ).map((item) => item.id),
    ).toEqual(["pending-hydration"]);
  });
});

describe("buildEventAlbumCardCountMap", () => {
  it("counts only combined-surface albums for event cards", () => {
    const counts = buildEventAlbumCardCountMap([
      {
        eventId: "event-1",
        showOnClubProfile: false,
        showOnOwnProfile: true,
        showOnProfile: true,
      },
      {
        eventId: "event-1",
        showOnClubProfile: true,
        showOnOwnProfile: false,
        showOnProfile: true,
      },
      {
        eventId: "event-1",
        showOnClubProfile: true,
        showOnOwnProfile: true,
        showOnProfile: true,
      },
      {
        eventId: "event-2",
        showOnClubProfile: true,
        showOnOwnProfile: false,
        showOnProfile: true,
      },
    ] as any);

    expect(Array.from(counts.entries())).toEqual([["event-1", 1]]);
  });
});
