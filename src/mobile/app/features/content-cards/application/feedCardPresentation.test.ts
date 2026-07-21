import { formatContentAgeLabel } from "./feedCardPresentation";

describe("formatContentAgeLabel", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");

  it("uses compact relative labels for recent content", () => {
    expect(formatContentAgeLabel("2026-07-21T11:59:40.000Z", now)).toBe("Şimdi");
    expect(formatContentAgeLabel("2026-07-21T11:42:00.000Z", now)).toBe("18 dk.");
    expect(formatContentAgeLabel("2026-07-21T09:00:00.000Z", now)).toBe("3 sa.");
  });

  it("falls back to a calendar label for older content", () => {
    expect(formatContentAgeLabel("2026-07-01T12:00:00.000Z", now)).toContain("Tem");
  });
});
