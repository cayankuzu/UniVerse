jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  documentDirectory: "file:///documents/",
  makeDirectoryAsync: jest.fn(),
}));

import { copyAsync, deleteAsync, makeDirectoryAsync } from "expo-file-system/legacy";
import {
  buildAlbumUploadMediaAccessErrorMessage,
  cleanupAlbumUploadPayloadMedia,
  persistAlbumUploadMediaUris,
  stabilizeAlbumUploadPayloadMedia,
} from "./albumUploadQueue.media";

const mockCopyAsync = copyAsync as jest.Mock;
const mockDeleteAsync = deleteAsync as jest.Mock;
const mockMakeDirectoryAsync = makeDirectoryAsync as jest.Mock;

describe("albumUploadQueue.media", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCopyAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
  });

  it("copies Android gallery media into an app-owned queue directory", async () => {
    const persistedImages = await persistAlbumUploadMediaUris({
      images: ["content://media/external/images/media/42", "file:///cache/already-local.jpg"],
      mediaKinds: ["image", "image"],
    });

    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(
      "file:///documents/album-upload-queue-media/",
      { intermediates: true },
    );
    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: "content://media/external/images/media/42",
      to: expect.stringMatching(/^file:\/\/\/documents\/album-upload-queue-media\/.*\.jpg$/),
    });
    expect(persistedImages[0]).toMatch(/^file:\/\/\/documents\/album-upload-queue-media\/.*\.jpg$/);
    expect(persistedImages[1]).toBe("file:///cache/already-local.jpg");
  });

  it("rewrites queued payload image fields to the app-owned copies", async () => {
    const result = await stabilizeAlbumUploadPayloadMedia({
      eventId: "event-1",
      image: "content://media/external/video/media/7",
      images: ["content://media/external/video/media/7"],
      mediaKinds: ["video"],
    });

    expect(result.changed).toBe(true);
    expect(result.payload.image).toMatch(
      /^file:\/\/\/documents\/album-upload-queue-media\/.*\.mp4$/,
    );
    expect(result.payload.images).toEqual([result.payload.image]);
    expect(result.payload.mediaKinds).toEqual(["video"]);
  });

  it("cleans up only app-owned queued media files", async () => {
    await cleanupAlbumUploadPayloadMedia({
      images: [
        "file:///documents/album-upload-queue-media/queued-a.jpg",
        "content://media/external/images/media/42",
      ],
    });

    expect(mockDeleteAsync).toHaveBeenCalledTimes(1);
    expect(mockDeleteAsync).toHaveBeenCalledWith(
      "file:///documents/album-upload-queue-media/queued-a.jpg",
      { idempotent: true },
    );
  });

  it("throws a clear gallery access error when the source uri cannot be copied", async () => {
    mockCopyAsync.mockRejectedValueOnce(new Error("Permission denied"));

    await expect(
      persistAlbumUploadMediaUris({
        images: ["content://media/external/images/media/42"],
        mediaKinds: ["image"],
      }),
    ).rejects.toThrow(buildAlbumUploadMediaAccessErrorMessage());
  });
});
