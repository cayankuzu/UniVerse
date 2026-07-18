import { prepareHomeFeedItems } from "./homeFeedAdapters";

describe("prepareHomeFeedItems", () => {
  it("builds stable prepared event rows with card-ready presentation fields", () => {
    const [item] = prepareHomeFeedItems([
      {
        actor: "club",
        event: {
          albumCount: 1,
          categories: ["Muzik"],
          club: "Uni Club",
          clubImage: "avatars/club-a.jpg",
          clubUsername: "uniclub",
          createdAt: "2026-03-28T10:00:00.000Z",
          fee: "Ücretsiz",
          id: "event-1",
          image: "events/event-1.jpg",
          likes: 8,
          startDate: "2026-03-29",
          startTime: "18:00",
          endTime: "20:00",
          title: "Spring Jam",
          type: "Concert",
          university: "Uni",
        } as any,
        id: "event:event-1",
        kind: "event",
        sortDate: "2026-03-28T10:00:00.000Z",
        source: "following",
      },
    ]);

    expect(item.firstFoldVariant).toBe("thumbnail");
    expect(item.primaryClubUsername).toBe("uniclub");
    expect(item.rowSignature).toContain("event:event-1");
    expect(item.homePresentation).toMatchObject({
      albumCount: 1,
      avatarInitials: "UC",
      clubSubtitle: "Uni",
      createdAtDateLabel: expect.any(String),
      createdAtTimeLabel: expect.any(String),
      metaChips: expect.arrayContaining([{ kind: "type", label: "Concert" }]),
    });

    const [preparedAgain] = prepareHomeFeedItems([
      {
        actor: "club",
        event: {
          albumCount: 1,
          categories: ["Muzik"],
          club: "Uni Club",
          clubImage: "avatars/club-a.jpg",
          clubUsername: "uniclub",
          createdAt: "2026-03-28T10:00:00.000Z",
          fee: "Ücretsiz",
          id: "event-1",
          image: "events/event-1.jpg",
          likes: 8,
          startDate: "2026-03-29",
          startTime: "18:00",
          endTime: "20:00",
          title: "Spring Jam",
          type: "Concert",
          university: "Uni",
        } as any,
        id: "event:event-1",
        kind: "event",
        sortDate: "2026-03-28T10:00:00.000Z",
        source: "following",
      },
    ]);

    expect(preparedAgain.rowSignature).toBe(item.rowSignature);
  });

  it("builds prepared album rows with stable summary metadata", () => {
    const [item] = prepareHomeFeedItems([
      {
        actor: "student",
        album: {
          clubUsername: "uniclub",
          createdAt: "2026-03-28T11:00:00.000Z",
          eventId: "event-1",
          id: "album-1",
          image: "albums/album-1.jpg",
          images: ["albums/album-1.jpg"],
          name: "Uni Club",
          photoCount: 2,
          showOnClubProfile: true,
          showOnOwnProfile: true,
          title: "After Movie",
          userImage: "avatars/club-a.jpg",
          userUniversity: "Uni",
          username: "uniclub",
        } as any,
        id: "album:album-1",
        kind: "album",
        sortDate: "2026-03-28T11:00:00.000Z",
        source: "following",
      },
    ]);

    expect(item.firstFoldVariant).toBe("thumbnail");
    expect(item.rowSignature).toContain("album:album-1");
    expect(item.homePresentation).toMatchObject({
      avatarInitials: "UC",
      createdAtLabel: expect.any(String),
      photoCount: 2,
      universityLabel: "Uni",
      visibility: {
        text: "Kendim ve Kulüp",
        type: "club",
      },
    });
  });

  it("changes the home album row signature when album surface visibility changes", () => {
    const [ownOnlyItem] = prepareHomeFeedItems([
      {
        actor: "student",
        album: {
          createdAt: "2026-03-28T11:00:00.000Z",
          eventId: "event-1",
          id: "album-1",
          image: "albums/album-1.jpg",
          images: ["albums/album-1.jpg"],
          name: "Uni Club",
          photoCount: 2,
          showOnClubProfile: false,
          showOnOwnProfile: true,
          surfaceVisibility: {
            label: { text: "Kendim", type: "own" },
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
          },
          title: "After Movie",
          userImage: "avatars/club-a.jpg",
          userUniversity: "Uni",
          username: "uniclub",
        } as any,
        id: "album:album-1",
        kind: "album",
        sortDate: "2026-03-28T11:00:00.000Z",
        source: "following",
      },
    ]);
    const [sharedItem] = prepareHomeFeedItems([
      {
        actor: "student",
        album: {
          createdAt: "2026-03-28T11:00:00.000Z",
          eventId: "event-1",
          id: "album-1",
          image: "albums/album-1.jpg",
          images: ["albums/album-1.jpg"],
          name: "Uni Club",
          photoCount: 2,
          showOnClubProfile: false,
          showOnOwnProfile: true,
          surfaceVisibility: {
            label: { text: "Kendim ve Kulüp", type: "club" },
            showOnClubProfile: true,
            showOnOwnProfile: true,
            showOnProfile: true,
          },
          title: "After Movie",
          userImage: "avatars/club-a.jpg",
          userUniversity: "Uni",
          username: "uniclub",
        } as any,
        id: "album:album-1",
        kind: "album",
        sortDate: "2026-03-28T11:00:00.000Z",
        source: "following",
      },
    ]);

    expect(ownOnlyItem.homePresentation).toMatchObject({
      visibility: { text: "Kendim", type: "own" },
    });
    expect(sharedItem.homePresentation).toMatchObject({
      visibility: { text: "Kendim ve Kulüp", type: "club" },
    });
    expect(sharedItem.rowSignature).not.toBe(ownOnlyItem.rowSignature);
  });
});
