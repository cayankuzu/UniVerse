import {
  prepareViewerData,
  resolveViewerInitialIndex,
  resolveViewerListInstanceKey,
} from "./viewerTarget";

describe("viewerTarget", () => {
  it("keeps the original feed order and resolves the targeted card index", () => {
    expect(
      prepareViewerData({
        data: [{ id: "album-1" }, { id: "album-2" }, { id: "album-3" }],
        initialIndex: 0,
        initialItemId: "album-3",
      }),
    ).toEqual({
      data: [{ id: "album-1" }, { id: "album-2" }, { id: "album-3" }],
      initialIndex: 2,
    });
  });

  it("falls back to the clamped initial index when the id is missing", () => {
    expect(
      resolveViewerInitialIndex({
        data: [{ id: "event-1" }, { id: "event-2" }],
        initialIndex: 9,
        initialItemId: "event-99",
      }),
    ).toBe(1);
  });

  it("builds a stable list key from the targeted card so viewer remounts on each selection", () => {
    expect(
      resolveViewerListInstanceKey({
        initialIndex: 2,
        initialItemId: "event-42",
        listType: "events",
        totalItems: 5,
      }),
    ).toBe("events:event-42:count:5");
  });
});
