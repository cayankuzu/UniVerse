import {
  MAX_HOME_STARTUP_PREVIEW_AGE_MS,
  shouldUseHomeStartupPreview,
} from "./homeStartupPreviewPolicy";

describe("shouldUseHomeStartupPreview", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps a recent startup snapshot visible while live projection content is empty", () => {
    jest.spyOn(Date, "now").mockReturnValue(MAX_HOME_STARTUP_PREVIEW_AGE_MS + 2_000);

    expect(
      shouldUseHomeStartupPreview({
        hasProjectionContent: false,
        startupPreviewItemsLength: 4,
        startupSnapshotSavedAt: 2_001,
      }),
    ).toBe(true);
  });

  it("turns off the startup snapshot once the live projection has content", () => {
    expect(
      shouldUseHomeStartupPreview({
        hasProjectionContent: true,
        startupPreviewItemsLength: 4,
        startupSnapshotSavedAt: Date.now(),
      }),
    ).toBe(false);
  });

  it("drops stale startup snapshots", () => {
    jest.spyOn(Date, "now").mockReturnValue(MAX_HOME_STARTUP_PREVIEW_AGE_MS + 2_000);

    expect(
      shouldUseHomeStartupPreview({
        hasProjectionContent: false,
        startupPreviewItemsLength: 4,
        startupSnapshotSavedAt: 999,
      }),
    ).toBe(false);
  });
});
