import { renderHook } from "@testing-library/react-native";
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import { useProfileProjectionContentState } from "./useProfileProjectionContentState";

function buildAlbum(overrides: Partial<AlbumPhotoWithMeta> = {}): AlbumPhotoWithMeta {
  return {
    comments: 0,
    createdAt: "2026-07-19T12:00:00.000Z",
    eventId: "event-1",
    eventTitle: "Launch Event",
    id: "album-1",
    image: "https://example.com/album.jpg",
    liked: false,
    likes: 0,
    name: "Uploader",
    showOnClubProfile: true,
    showOnOwnProfile: true,
    showOnProfile: true,
    userId: "user-1",
    userImage: "",
    username: "uploader",
    ...overrides,
  };
}

function buildEvent(overrides: Partial<EventWithMeta> = {}): EventWithMeta {
  return {
    access: "",
    address: "",
    attendees: 0,
    capacity: 0,
    categories: [],
    category: "",
    club: "CYN Club",
    clubImage: "",
    clubUserId: "club-1",
    clubUsername: "cyn",
    comments: 0,
    createdAt: "2026-07-19T12:00:00.000Z",
    date: "2026-07-19",
    description: "",
    endDate: "2026-07-19",
    endTime: "",
    fee: "",
    id: "event-1",
    image: "",
    joined: false,
    level: "",
    liked: false,
    likes: 0,
    location: "",
    materials: "",
    startDate: "2026-07-19",
    startTime: "",
    targetAudience: "",
    title: "Launch Event",
    type: "",
    university: "",
    visibility: "public",
    ...overrides,
  };
}

describe("useProfileProjectionContentState", () => {
  it("keeps both preloaded profile collections available at the same time", () => {
    const album = buildAlbum();
    const event = buildEvent();
    const { result } = renderHook(() =>
      useProfileProjectionContentState({
        albumItems: [album],
        enabled: true,
        eventItems: [event],
      }),
    );

    expect(result.current.sourceAlbums).toEqual([expect.objectContaining({ id: "album-1" })]);
    expect(result.current.sourceEvents).toEqual([expect.objectContaining({ id: "event-1" })]);
  });

  it("preserves albums visible on both the personal and club profile surfaces", () => {
    const { result } = renderHook(() =>
      useProfileProjectionContentState({
        albumItems: [buildAlbum()],
        enabled: true,
        eventItems: [],
      }),
    );

    expect(result.current.sourceAlbums[0]).toMatchObject({
      id: "album-1",
      showOnClubProfile: true,
      showOnOwnProfile: true,
    });
  });

  it("exposes no content while profile access is disabled", () => {
    const { result } = renderHook(() =>
      useProfileProjectionContentState({
        albumItems: [buildAlbum()],
        enabled: false,
        eventItems: [buildEvent()],
      }),
    );

    expect(result.current.sourceAlbums).toEqual([]);
    expect(result.current.sourceEvents).toEqual([]);
  });
});
