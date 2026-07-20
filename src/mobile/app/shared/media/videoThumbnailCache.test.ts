const mockGenerateThumbnailsAsync = jest.fn();
const mockRelease = jest.fn();
const mockCreateVideoPlayer = jest.fn(() => ({
  generateThumbnailsAsync: mockGenerateThumbnailsAsync,
  release: mockRelease,
}));
const mockRunLowPriorityTask = jest.fn(async (task: () => Promise<unknown> | unknown) => task());

jest.mock("expo-video", () => ({
  createVideoPlayer: mockCreateVideoPlayer,
}));

jest.mock("../utils/lowPriorityTaskScheduler", () => ({
  runLowPriorityTask: mockRunLowPriorityTask,
}));

describe("videoThumbnailCache", () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateVideoPlayer.mockClear();
    mockGenerateThumbnailsAsync.mockReset();
    mockRelease.mockReset();
    mockRunLowPriorityTask.mockClear();
  });

  it("samples a later opening frame before falling back to the first frame", async () => {
    const { resolveVideoThumbnail } =
      require("./videoThumbnailCache") as typeof import("./videoThumbnailCache");
    const thumbnail = { uri: "file:///thumb.jpg" } as never;
    mockGenerateThumbnailsAsync.mockResolvedValue([thumbnail]);

    const result = await resolveVideoThumbnail("file:///video.mp4");

    expect(result).toBe(thumbnail);
    expect(mockGenerateThumbnailsAsync).toHaveBeenCalledWith([0.35, 0.18, 0.05], {
      maxHeight: 480,
      maxWidth: 480,
    });
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached thumbnail for repeat requests", async () => {
    const { getCachedVideoThumbnail, resolveVideoThumbnail } =
      require("./videoThumbnailCache") as typeof import("./videoThumbnailCache");
    const thumbnail = { uri: "file:///thumb-repeat.jpg" } as never;
    mockGenerateThumbnailsAsync.mockResolvedValue([thumbnail]);

    await resolveVideoThumbnail("file:///repeat.mp4");
    const cached = getCachedVideoThumbnail("file:///repeat.mp4");
    const repeated = await resolveVideoThumbnail("file:///repeat.mp4");

    expect(cached).toBe(thumbnail);
    expect(repeated).toBe(thumbnail);
    expect(mockCreateVideoPlayer).toHaveBeenCalledTimes(1);
  });

  it("bypasses the low-priority queue for an eager visible-video request", async () => {
    const { resolveVideoThumbnail } =
      require("./videoThumbnailCache") as typeof import("./videoThumbnailCache");
    mockGenerateThumbnailsAsync.mockResolvedValue([{ uri: "file:///thumb-eager.jpg" } as never]);

    await resolveVideoThumbnail("file:///eager-video.mp4", { priority: "eager" });

    expect(mockRunLowPriorityTask).not.toHaveBeenCalled();
    expect(mockCreateVideoPlayer).toHaveBeenCalledTimes(1);
  });

  it("clears generated thumbnails on memory pressure", async () => {
    const { clearVideoThumbnailMemoryCache, getCachedVideoThumbnail, resolveVideoThumbnail } =
      require("./videoThumbnailCache") as typeof import("./videoThumbnailCache");
    mockGenerateThumbnailsAsync.mockResolvedValue([{ uri: "file:///thumb-clear.jpg" } as never]);

    await resolveVideoThumbnail("file:///clear.mp4");
    clearVideoThumbnailMemoryCache();

    expect(getCachedVideoThumbnail("file:///clear.mp4")).toBeNull();
  });
});
