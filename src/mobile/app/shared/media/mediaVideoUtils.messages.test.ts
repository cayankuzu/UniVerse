import {
  buildVideoCaptureLimitMessage,
  buildVideoDurationLimitMessage,
  buildVideoNormalizationFailureMessage,
  buildVideoSizeLimitMessage,
} from "./mediaVideoUtils";

describe("video validation messages", () => {
  it("provides actionable copy for each media limit", () => {
    expect(buildVideoDurationLimitMessage()).toContain("dakika");
    expect(buildVideoSizeLimitMessage()).toContain("MB");
    expect(buildVideoCaptureLimitMessage()).toContain("dakika");
    expect(buildVideoNormalizationFailureMessage()).toEqual(expect.any(String));
  });
});
