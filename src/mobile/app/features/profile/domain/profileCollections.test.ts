import {
  filterBlockedProfileEvents,
  filterBlockedProfileAlbums,
  hydrateProfileOwnedAlbums,
  sanitizeProfileEvents,
} from "../application/profileCollections";

describe("sanitizeProfileEvents", () => {
  it("keeps already-normalized event rows", () => {
    expect(
      sanitizeProfileEvents([
        {
          club: "Kulüp",
          clubImage: "",
          clubUserId: "club-1",
          clubUsername: "kulüp",
          createdAt: "2026-03-19T10:00:00.000Z",
          date: "2026-03-19",
          id: "event-1",
          title: "Etkinlik",
        },
      ]),
    ).toHaveLength(1);
  });

  it("unwraps profile event wrapper rows", () => {
    expect(
      sanitizeProfileEvents([
        {
          albumCount: 3,
          event: {
            club: "Kulüp",
            clubImage: "",
            clubUserId: "club-1",
            clubUsername: "kulüp",
            createdAt: "2026-03-19T10:00:00.000Z",
            date: "2026-03-19",
            id: "event-1",
            title: "Etkinlik",
          },
          id: "event-1",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        albumCount: 3,
        id: "event-1",
        title: "Etkinlik",
      }),
    ]);
  });
});

describe("hydrateProfileOwnedAlbums", () => {
  it("hydrates student album cards from the current profile overview", () => {
    const result = hydrateProfileOwnedAlbums(
      [
        {
          comments: 0,
          createdAt: "2026-03-19T10:00:00.000Z",
          eventId: "event-1",
          eventTitle: "Etkinlik",
          id: "album-1",
          image: "albums/cover.jpg",
          liked: false,
          likes: 0,
          name: "Eski Ad",
          userId: "user-1",
          userImage: "profiles/old.jpg",
          userUniversity: "Eski Üniversite",
          username: "old-cyn",
        },
      ],
      {
        accountType: "student",
        albumsCount: 1,
        categories: [],
        coverImage: "",
        createdAt: "2026-03-19T10:00:00.000Z",
        email: "cyn@example.com",
        followersCount: 0,
        followingCount: 0,
        id: "user-1",
        isPrivate: false,
        name: "Cyn Güncel",
        profileImage: "profiles/current.jpg",
        university: "Güncel Üniversite",
        username: "cyn",
      },
      "cyn",
      "user-1",
    );

    expect(result).toEqual([
      expect.objectContaining({
        name: "Cyn Güncel",
        userId: "user-1",
        userImage: "profiles/current.jpg",
        userUniversity: "Güncel Üniversite",
        username: "cyn",
        university: "Güncel Üniversite",
      }),
    ]);
  });

  it("hydrates only club-owned albums on club profiles", () => {
    const result = hydrateProfileOwnedAlbums(
      [
        {
          clubName: "Eski Kulüp",
          clubUserId: "club-1",
          clubUsername: "old-club",
          comments: 0,
          createdAt: "2026-03-19T10:00:00.000Z",
          eventId: "event-1",
          eventTitle: "Etkinlik",
          id: "album-owned",
          image: "albums/owned.jpg",
          liked: false,
          likes: 0,
          name: "Eski Kulüp",
          userId: "club-1",
          userImage: "profiles/old-club.jpg",
          userUniversity: "Eski Üniversite",
          username: "old-club",
        },
        {
          clubName: "Eski Kulüp",
          clubUserId: "club-1",
          clubUsername: "old-club",
          comments: 0,
          createdAt: "2026-03-19T10:00:00.000Z",
          eventId: "event-1",
          eventTitle: "Etkinlik",
          id: "album-guest",
          image: "albums/guest.jpg",
          liked: false,
          likes: 0,
          name: "Misafir",
          userId: "student-1",
          userImage: "profiles/guest.jpg",
          userUniversity: "Misafir Üniversite",
          username: "guest-user",
        },
      ],
      {
        accountType: "club",
        albumsCount: 2,
        categories: [],
        clubName: "Güncel Kulüp",
        coverImage: "",
        createdAt: "2026-03-19T10:00:00.000Z",
        email: "club@example.com",
        followersCount: 0,
        followingCount: 0,
        id: "club-1",
        isPrivate: false,
        profileImage: "profiles/current-club.jpg",
        university: "Güncel Üniversite",
        username: "new-club",
      },
      "new-club",
      "club-1",
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        clubName: "Güncel Kulüp",
        clubUserId: "club-1",
        clubUsername: "new-club",
        name: "Güncel Kulüp",
        userImage: "profiles/current-club.jpg",
        username: "new-club",
      }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        name: "Misafir",
        userImage: "profiles/guest.jpg",
        username: "guest-user",
      }),
    );
  });
});

describe("filterBlockedProfileAlbums", () => {
  const viewerOwnedAlbum = {
    clubName: "Y Kulübü",
    clubUserId: "club-y",
    clubUsername: "club-y",
    comments: 0,
    createdAt: "2026-03-19T10:00:00.000Z",
    eventId: "event-1",
    eventTitle: "Etkinlik",
    id: "album-1",
    image: "albums/owned.jpg",
    liked: false,
    likes: 0,
    name: "X Kullanıcı",
    userId: "user-x",
    userImage: "profiles/x.jpg",
    userUniversity: "Uni",
    username: "user-x",
  };

  const studentProfile = {
    accountType: "student" as const,
    albumsCount: 1,
    categories: [],
    coverImage: "",
    createdAt: "2026-03-19T10:00:00.000Z",
    email: "x@example.com",
    followersCount: 0,
    followingCount: 0,
    id: "user-x",
    isPrivate: false,
    name: "X Kullanıcı",
    profileImage: "profiles/x.jpg",
    university: "Uni",
    username: "user-x",
  };

  it("keeps a viewer-owned blocked-club album on the viewer's own profile", () => {
    expect(
      filterBlockedProfileAlbums([viewerOwnedAlbum], new Set(["club-y"]), {
        isOwnProfile: true,
        ownerUserId: "user-x",
        ownerUsername: "user-x",
        profile: studentProfile,
      }),
    ).toEqual([viewerOwnedAlbum]);
  });

  it("removes the same album on non-owner profile surfaces when the club is blocked", () => {
    expect(
      filterBlockedProfileAlbums([viewerOwnedAlbum], new Set(["club-y"]), {
        isOwnProfile: false,
        ownerUserId: "user-x",
        ownerUsername: "user-x",
        profile: studentProfile,
      }),
    ).toEqual([]);
  });

  it("keeps a viewer-owned blocked-club album on the viewer's own profile before profile overview resolves", () => {
    expect(
      filterBlockedProfileAlbums([viewerOwnedAlbum], new Set(["club-y"]), {
        isOwnProfile: true,
        ownerUserId: "user-x",
        ownerUsername: "user-x",
      }),
    ).toEqual([viewerOwnedAlbum]);
  });

  it("hides blocked-club event cards on the viewer's own profile", () => {
    expect(
      filterBlockedProfileEvents(
        [
          {
            clubUserId: "club-y",
            clubUsername: "club-y",
            createdAt: "2026-03-19T10:00:00.000Z",
            date: "2026-03-19",
            id: "event-1",
            title: "Y Kulübü Etkinligi",
          },
        ] as any,
        new Set(["club-y"]),
      ),
    ).toEqual([]);
  });

  it("hides blocked-club event cards on non-owner profile surfaces", () => {
    expect(
      filterBlockedProfileEvents(
        [
          {
            clubUserId: "club-y",
            clubUsername: "club-y",
            createdAt: "2026-03-19T10:00:00.000Z",
            date: "2026-03-19",
            id: "event-1",
            title: "Y Kulübü Etkinligi",
          },
        ] as any,
        new Set(["club-y"]),
      ),
    ).toEqual([]);
  });
});
