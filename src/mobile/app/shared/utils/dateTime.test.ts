import { formatAbsoluteDateTime, timeAgo } from "./dateTime";

describe("dateTime", () => {
  it("formats ISO values as explicit date and time", () => {
    const iso = "2026-03-30T14:05:00.000Z";
    const formatted = formatAbsoluteDateTime(iso);

    expect(formatted).toMatch(/30\.03\.2026 \d{2}:\d{2}/);
    expect(timeAgo(iso)).toBe(formatted);
  });

  it("returns an empty string for invalid absolute inputs", () => {
    expect(formatAbsoluteDateTime("")).toBe("");
    expect(timeAgo("not-a-date")).toBe("Tarih bilinmiyor");
  });
});
