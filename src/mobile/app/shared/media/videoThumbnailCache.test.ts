const mockGenerateThumbnailsAsync = jest.fn();
const mockRelease = jest.fn();
const mockCreateVideoPlayer = jest.fn(() => ({
  generateThumbnailsAsync: mockGenerateThumbnailsAsync,
  release: mockRelease,
}));
const mockRunLowPriorityTask = jest.fn(async (task: () => Promise<unknown> | unknown) => task());
const mockGetThumbnail = jest.fn();

jest.mock("expo-modules-core", () => ({
  requireOptionalNativeModule: jest.fn(() => ({ getThumbnail: mockGetThumbnail })),
}));

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
    mockGetThumbnail.mockReset();
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

  it("retries after a transient thumbnail generation failure", async () => {
    const { resolveVideoThumbnail } =
      require("./videoThumbnailCache") as typeof import("./videoThumbnailCache");
    const thumbnail = { uri: "file:///thumb-retry.jpg" } as never;
    mockGenerateThumbnailsAsync.mockResolvedValueOnce([]).mockResolvedValueOnce([thumbnail]);

    const first = await resolveVideoThumbnail("https://cdn.example.com/retry.mp4");
    const second = await resolveVideoThumbnail("https://cdn.example.com/retry.mp4");

    expect(first).toBeNull();
    expect(second).toBe(thumbnail);
    expect(mockCreateVideoPlayer).toHaveBeenCalledTimes(2);
    expect(mockRelease).toHaveBeenCalledTimes(2);
  });

  it("clears generated thumbnails on memory pressure", async () => {
    const { clearVideoThumbnailMemoryCache, getCachedVideoThumbnail, resolveVideoThumbnail } =
      require("./videoThumbnailCache") as typeof import("./videoThumbnailCache");
    mockGenerateThumbnailsAsync.mockResolvedValue([{ uri: "file:///thumb-clear.jpg" } as never]);

    await resolveVideoThumbnail("file:///clear.mp4");
    clearVideoThumbnailMemoryCache();

    expect(getCachedVideoThumbnail("file:///clear.mp4")).toBeNull();
  });

  it("generates a native thumbnail URI only for supported local schemes", async () => {
    const { generateVideoThumbnailUri } =
      require("./videoThumbnailCache") as typeof import("./videoThumbnailCache");
    mockGetThumbnail.mockResolvedValue({ uri: "file:///native-thumb.jpg" });

    await expect(generateVideoThumbnailUri("https://cdn.example.com/video.mp4")).resolves.toBe(
      undefined,
    );
    await expect(generateVideoThumbnailUri("content://video/1", -50)).resolves.toBe(
      "file:///native-thumb.jpg",
    );

    expect(mockGetThumbnail).toHaveBeenCalledWith("content://video/1", {
      quality: 0.72,
      time: 0,
    });
  });
});
