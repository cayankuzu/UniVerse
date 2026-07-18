import { normalizeAlbumProjectionItem } from "./albums.shared";

describe("normalizeAlbumProjectionItem", () => {
  it("keeps own-only profile visibility when the club flag is explicitly false", () => {
    expect(
      normalizeAlbumProjectionItem({
        created_at: "2026-03-14T00:00:00.000Z",
        event_id: "event-1",
        event_title: "Event",
        id: "album-1",
        image: "albums/photo.jpg",
        show_on_club_profile: false,
        show_on_profile: true,
        show_on_user_profile: true,
        user_id: "viewer-1",
        username: "viewer",
      }),
    ).toMatchObject({
      showOnClubProfile: false,
      showOnOwnProfile: true,
      showOnProfile: true,
      surfaceVisibility: {
        label: { text: "Kendim", type: "own" },
        showOnClubProfile: false,
        showOnOwnProfile: true,
        showOnProfile: true,
      },
    });
  });

  it("does not infer club visibility from show_on_profile when the club flag is missing", () => {
    expect(
      normalizeAlbumProjectionItem({
        created_at: "2026-03-14T00:00:00.000Z",
        event_id: "event-1",
        event_title: "Event",
        id: "album-2",
        image: "albums/photo.jpg",
        show_on_profile: true,
        show_on_user_profile: true,
        user_id: "viewer-1",
        username: "viewer",
      }),
    ).toMatchObject({
      showOnClubProfile: false,
      showOnOwnProfile: true,
      showOnProfile: true,
      surfaceVisibility: {
        label: { text: "Kendim", type: "own" },
        showOnClubProfile: false,
        showOnOwnProfile: true,
        showOnProfile: true,
      },
    });
  });

  it("does not infer own visibility from show_on_profile when the own flag is missing", () => {
    expect(
      normalizeAlbumProjectionItem({
        created_at: "2026-03-14T00:00:00.000Z",
        event_id: "event-1",
        event_title: "Event",
        id: "album-2b",
        image: "albums/photo.jpg",
        show_on_club_profile: false,
        show_on_profile: true,
        user_id: "viewer-1",
        username: "viewer",
      }),
    ).toMatchObject({
      showOnClubProfile: false,
      showOnOwnProfile: false,
      showOnProfile: true,
      surfaceVisibility: {
        label: { text: "Kendim", type: "own" },
        showOnClubProfile: false,
        showOnOwnProfile: false,
        showOnProfile: true,
      },
    });
  });

  it("preserves private-club flags from projection rows", () => {
    expect(
      normalizeAlbumProjectionItem({
        caption: "Caption",
        club_is_private: true,
        club_username: "fanzin",
        created_at: "2026-03-14T00:00:00.000Z",
        event_id: "event-1",
        event_title: "Event",
        photo_id: "album-3",
        show_on_profile: true,
        storage_path: "albums/photo.jpg",
        uploader_id: "viewer-1",
        uploader_name: "Viewer",
        uploader_username: "viewer",
      }),
    ).toMatchObject({
      clubIsPrivate: true,
      clubUsername: "fanzin",
      id: "album-3",
    });
  });
});
