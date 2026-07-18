jest.mock("../../../platform/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

import { normalizeProjectionEvent } from "./events.models";

describe("normalizeProjectionEvent", () => {
  it("rejects album-shaped projection rows", () => {
    expect(
      normalizeProjectionEvent({
        id: "album-1",
        caption: "Album aciklamasi",
        clubUsername: "kulüp",
        eventId: "event-1",
        eventTitle: "Etkinlik",
        image: "albums/photo.jpg",
        photoCount: 2,
        username: "Öğrenci",
      }),
    ).toBeNull();
  });

  it("normalizes valid event projection rows", () => {
    expect(
      normalizeProjectionEvent({
        id: "event-1",
        clubUsername: "kulüp",
        clubUserId: "club-1",
        club: "Kulüp",
        title: "Konser",
        date: "2026-03-14",
        startDate: "2026-03-14",
        endDate: "2026-03-14",
        startTime: "20:00",
        endTime: "22:00",
        location: "Salon",
        type: "muzik",
      }),
    ).toMatchObject({
      id: "event-1",
      clubUsername: "kulüp",
      clubUserId: "club-1",
      title: "Konser",
      date: "2026-03-14",
      location: "Salon",
      type: "muzik",
    });
  });

  it("preserves albumCount on rpc-shaped event rows", () => {
    expect(
      normalizeProjectionEvent({
        id: "event-2",
        club_user_id: "club-1",
        club_username: "kulüp",
        club_name: "Kulüp",
        club_image: "",
        university: "Uni",
        title: "Sergi",
        description: "",
        cover_image_path: "",
        starts_at: "2026-03-14T20:00:00Z",
        ends_at: "2026-03-14T22:00:00Z",
        location_name: "Galeri",
        address: "",
        event_type: "sergi",
        category: "sanat",
        categories: [],
        fee_label: "Ücretsiz",
        access_label: "Açık",
        capacity: 50,
        target_audience: "",
        level: "",
        materials: "",
        visibility: "public",
        created_at: "2026-03-14T10:00:00Z",
        likes_count: 3,
        liked: false,
        attendees_count: 4,
        joined: false,
        album_count: 2,
        effective_visibility: "public",
        club_is_private: true,
      }),
    ).toMatchObject({
      id: "event-2",
      albumCount: 2,
      clubIsPrivate: true,
    });
  });

  it("keeps attendee count at least one when the viewer is already joined", () => {
    expect(
      normalizeProjectionEvent({
        id: "event-3",
        club_user_id: "club-1",
        club_username: "kulup",
        club_name: "Kulup",
        club_image: "",
        university: "Uni",
        title: "Atolye",
        description: "",
        cover_image_path: "",
        starts_at: "2026-03-14T20:00:00Z",
        ends_at: "2026-03-14T22:00:00Z",
        location_name: "Salon",
        address: "",
        event_type: "atolye",
        category: "egitim",
        categories: [],
        fee_label: "Ucretsiz",
        access_label: "Acik",
        capacity: 100,
        target_audience: "",
        level: "",
        materials: "",
        visibility: "public",
        created_at: "2026-03-14T10:00:00Z",
        likes_count: 0,
        liked: false,
        attendees_count: 0,
        joined: true,
        effective_visibility: "public",
        club_is_private: false,
      }),
    ).toMatchObject({
      id: "event-3",
      joined: true,
      attendees: 1,
    });
  });
});
