jest.mock("../../../data/normalizers/albums", () => ({
  mergeAlbumCollections: jest.fn((...collections: unknown[][]) => collections.flat()),
  normalizeAlbumProjectionItem: jest.fn((item: unknown) => {
    const row = item as { kind?: string };
    return row?.kind === "album" ? item : null;
  }),
}));

jest.mock("../../../data/normalizers/events", () => ({
  normalizeProjectionEvent: jest.fn((item: unknown) => {
    const row = item as { kind?: string };
    return row?.kind === "event" ? item : null;
  }),
}));

jest.mock("../../../shared/i18n", () => ({
  t: jest.fn((key: string) => key),
}));

import { sanitizeProfileAlbums, sanitizeProfileEvents } from "../application/profileCollections";

describe("profileCollections sanitizers", () => {
  it("drops album-shaped rows from profile events", () => {
    expect(
      sanitizeProfileEvents([
        { id: "event-1", kind: "event" },
        { id: "album-1", kind: "album" },
      ]),
    ).toEqual([{ id: "event-1", kind: "event" }]);
  });

  it("drops event-shaped rows from profile albums", () => {
    expect(
      sanitizeProfileAlbums([
        { id: "album-1", kind: "album" },
        { id: "event-1", kind: "event" },
      ]),
    ).toEqual([{ id: "album-1", kind: "album" }]);
  });

  it("drops realistic event rows from profile albums even without a kind marker", () => {
    expect(
      sanitizeProfileAlbums([
        {
          createdAt: "2026-03-20T12:00:00.000Z",
          date: "2026-03-20",
          id: "event-2",
          image: "events/event-cover.jpg",
          location: "Campus Hall",
          startDate: "2026-03-20",
          title: "Launch Event",
        },
      ]),
    ).toEqual([]);
  });
});
