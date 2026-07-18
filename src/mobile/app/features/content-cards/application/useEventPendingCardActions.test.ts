import { resolvePendingEventStatus } from "./useEventPendingCardActions";

describe("resolvePendingEventStatus", () => {
  it("prefers explicit upload status values", () => {
    expect(resolvePendingEventStatus("event-1", "failed")).toBe("failed");
    expect(resolvePendingEventStatus("event-1", "uploading")).toBe("uploading");
  });

  it("treats temp events as pending when upload status is missing", () => {
    expect(resolvePendingEventStatus("temp-event:123", undefined)).toBe("pending");
  });

  it("returns undefined for persisted events without upload status", () => {
    expect(resolvePendingEventStatus("event-1", undefined)).toBeUndefined();
  });
});
