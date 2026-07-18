import { resolveEventAttendeesCount } from "./events.attendeeCount";

describe("resolveEventAttendeesCount", () => {
  it("returns at least one attendee for joined viewers", () => {
    expect(resolveEventAttendeesCount(0, true)).toBe(1);
  });

  it("keeps the backend count when it is already higher", () => {
    expect(resolveEventAttendeesCount(4, true)).toBe(4);
  });

  it("keeps zero when the viewer is not joined", () => {
    expect(resolveEventAttendeesCount(0, false)).toBe(0);
  });
});
