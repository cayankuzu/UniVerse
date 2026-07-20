jest.mock("../../../data/content/albums/albums.local", () => ({
  persistLocalAlbumShadow: jest.fn(async () => undefined),
}));

jest.mock("../../../data/queues/uploadQueue", () => ({
  getUploadEntry: jest.fn(),
  isRetryableUploadError: jest.fn(
    (error: { retryableQueueError?: boolean }) => error?.retryableQueueError === true,
  ),
  patchUploadEntry: jest.fn(async (_entryId: string, patch: unknown) => patch),
  processUploadQueue: jest.fn(),
}));

jest.mock("../../../data/storage/storage", () => ({
  StorageAPI: {
    cancelUploadSession: jest.fn(),
    createUploadSession: jest.fn(),
    finalizeUploadSession: jest.fn(),
    prepareUploadFile: jest.fn(async (file: unknown) => file),
    uploadPreparedFile: jest.fn(),
    uploadFile: jest.fn(),
  },
}));

jest.mock("../../../platform/supabase/authSession", () => ({
  recoverAuthState: jest.fn(),
}));

jest.mock("../../../platform/media/fileIntegrity", () => ({
  calculateLocalFileIntegrity: jest.fn(async (uri: string) => ({
    checksumSha256: uri.includes("video") ? "b".repeat(64) : "a".repeat(64),
    sizeBytes: uri.includes("video") ? 2_000 : 1_000,
  })),
}));

jest.mock("./albumUploadQueue.media", () => ({
  buildAlbumUploadMediaAccessErrorMessage: jest.fn(
    () =>
      "Secilen medya dosyasina Android galerisi uzerinden erisilemiyor. Karti silip medyayi galeriden yeniden sec.",
  ),
  cleanupAlbumUploadPayloadMedia: jest.fn(async () => undefined),
  getAlbumUploadPayloadImages: jest.fn((payload: Record<string, unknown>) =>
    Array.isArray(payload.images)
      ? payload.images.map(String).filter(Boolean)
      : payload.image
        ? [String(payload.image)]
        : [],
  ),
  isAndroidGalleryAlbumMediaUri: jest.fn(() => false),
  stabilizeAlbumUploadPayloadMedia: jest.fn(async (payload: Record<string, unknown>) => ({
    changed: false,
    payload,
  })),
}));

jest.mock("./albumUploadQueueCache", () => ({
  patchAlbumUploadCaches: jest.fn(),
}));

jest.mock("./remote/albums.api", () => ({
  AlbumAPI: {
    uploadPhoto: jest.fn(),
  },
}));

import {
  getUploadEntry,
  patchUploadEntry,
  processUploadQueue,
} from "../../../data/queues/uploadQueue";
import { StorageAPI } from "../../../data/storage/storage";
import { recoverAuthState } from "../../../platform/supabase/authSession";
import { AlbumAPI } from "./remote/albums.api";
import { processAlbumUploadQueue } from "./albumUploadQueueProcessor";

const mockGetUploadEntry = getUploadEntry as jest.Mock;
const mockProcessUploadQueue = processUploadQueue as jest.Mock;
const mockPatchUploadEntry = patchUploadEntry as jest.Mock;
const mockCancelUploadSession = StorageAPI.cancelUploadSession as jest.Mock;
const mockCreateUploadSession = StorageAPI.createUploadSession as jest.Mock;
const mockFinalizeUploadSession = StorageAPI.finalizeUploadSession as jest.Mock;
const mockPrepareUploadFile = StorageAPI.prepareUploadFile as jest.Mock;
const mockUploadFile = StorageAPI.uploadPreparedFile as jest.Mock;
const mockRecoverAuthState = recoverAuthState as jest.Mock;
const mockUploadPhoto = AlbumAPI.uploadPhoto as jest.Mock;

describe("albumUploadQueueProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecoverAuthState.mockResolvedValue({
      accessToken: "token-1",
      user: { id: "viewer-id" },
    });
    mockCreateUploadSession.mockImplementation(
      async ({ items }: { items: Array<{ mediaIndex: number }> }) => ({
        sessionId: "session-default",
        tickets: items.map(({ mediaIndex }) => ({
          mediaIndex,
          path: `albums/viewer-id/session-default-${mediaIndex}`,
          uploadUrl: `https://upload.example/${mediaIndex}`,
        })),
      }),
    );
    mockCancelUploadSession.mockResolvedValue(undefined);
    mockFinalizeUploadSession.mockResolvedValue(undefined);
    mockPrepareUploadFile.mockImplementation(async (file: unknown) => file);
    mockUploadFile.mockResolvedValue("albums/viewer-id/video.mp4");
    mockUploadPhoto.mockResolvedValue({
      comments: 0,
      createdAt: "2026-03-13T00:00:00.000Z",
      eventId: "event-1",
      id: "album-1",
      image: "albums/viewer-id/photo.webp",
      images: ["albums/viewer-id/photo.webp", "albums/viewer-id/video.mp4"],
      liked: false,
      likes: 0,
      name: "Viewer",
      photoCount: 2,
      userId: "viewer-id",
      userImage: "",
      username: "viewer",
    });
    mockGetUploadEntry.mockResolvedValue({
      id: "temp-album:1",
      payload: {},
    });
  });

  it("resumes from uploaded media checkpoints and only uploads missing album media", async () => {
    const entry = {
      attemptCount: 1,
      createdAt: "2026-03-13T00:00:00.000Z",
      id: "temp-album:1",
      kind: "album-photo",
      maxAttempts: 24,
      nextProcessAt: null,
      ownerId: "viewer-id",
      payload: {
        clientMutationId: "album-upload:resume",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "file:///photo.jpg",
        images: ["file:///photo.jpg", "file:///video.mp4"],
        mediaKinds: ["image", "video"],
        uploadedImages: ["albums/viewer-id/photo.webp", ""],
        uploadSessionId: "session-default",
        uploaderUserId: "viewer-id",
      },
      status: "pending",
      updatedAt: "2026-03-13T00:00:00.000Z",
    };
    mockGetUploadEntry.mockImplementation(async () => entry);
    mockProcessUploadQueue.mockImplementationOnce(async (params) => {
      await params.handler(entry);
    });

    await processAlbumUploadQueue({
      accountType: "student",
      ownerId: "viewer-id",
      queryClient: {} as never,
      userData: {
        id: "viewer-id",
        profileImage: "",
        username: "viewer",
      },
      viewerKey: "viewer-id",
    });

    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(mockUploadFile).toHaveBeenCalledWith(
      {
        name: expect.stringMatching(/^album-.*\.mp4$/),
        type: "video/mp4",
        uri: "file:///video.mp4",
      },
      "albums",
      expect.objectContaining({
        accessToken: "token-1",
        context: "album/upload:temp-album:1:2",
        timeoutMs: expect.any(Number),
        uploadKey: "album-upload:resume:2",
      }),
    );
    expect(mockPatchUploadEntry).toHaveBeenCalledWith(
      "temp-album:1",
      expect.objectContaining({
        payload: expect.objectContaining({
          uploadedImages: ["albums/viewer-id/photo.webp", "albums/viewer-id/video.mp4"],
        }),
        status: "uploading",
      }),
    );
    expect(mockUploadPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "albums/viewer-id/photo.webp",
        images: ["albums/viewer-id/photo.webp", "albums/viewer-id/video.mp4"],
      }),
      {
        accessTokenHint: "token-1",
        userIdHint: "viewer-id",
      },
    );
    expect(mockPatchUploadEntry).toHaveBeenCalledWith(
      "temp-album:1",
      expect.objectContaining({
        payload: expect.objectContaining({
          __uploadProgress: expect.objectContaining({
            percent: 100,
            stage: "Paylasim tamamlandi",
          }),
        }),
        status: "uploading",
      }),
    );
  });

  it("stops before album creation when the pending upload is removed during processing", async () => {
    const entry = {
      attemptCount: 0,
      createdAt: "2026-03-13T00:00:00.000Z",
      id: "temp-album:cancel",
      kind: "album-photo",
      maxAttempts: 24,
      nextProcessAt: null,
      ownerId: "viewer-id",
      payload: {
        clientMutationId: "album-upload:cancel",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "file:///video.mp4",
        images: ["file:///video.mp4"],
        mediaKinds: ["video"],
        uploaderUserId: "viewer-id",
      },
      status: "pending",
      updatedAt: "2026-03-13T00:00:00.000Z",
    };
    let removedDuringUpload = false;
    mockGetUploadEntry.mockImplementation(async () => (removedDuringUpload ? null : entry));
    mockUploadFile.mockImplementation(async () => {
      removedDuringUpload = true;
      return "albums/viewer-id/video.mp4";
    });
    mockProcessUploadQueue.mockImplementationOnce(async (params) => {
      await params.handler(entry);
    });

    await processAlbumUploadQueue({
      accountType: "student",
      ownerId: "viewer-id",
      queryClient: {} as never,
      userData: {
        id: "viewer-id",
        profileImage: "",
        username: "viewer",
      },
      viewerKey: "viewer-id",
    });

    expect(mockUploadPhoto).not.toHaveBeenCalled();
  });

  it("fails closed before media transfer when a verified upload session cannot be created", async () => {
    const entry = {
      attemptCount: 0,
      createdAt: "2026-03-13T00:00:00.000Z",
      id: "temp-album:no-session",
      kind: "album-photo",
      maxAttempts: 24,
      nextProcessAt: null,
      ownerId: "viewer-id",
      payload: {
        clientMutationId: "album-upload:no-session",
        eventId: "event-1",
        image: "file:///photo.jpg",
        images: ["file:///photo.jpg"],
        mediaKinds: ["image"],
        uploaderUserId: "viewer-id",
      },
      status: "pending",
      updatedAt: "2026-03-13T00:00:00.000Z",
    };
    mockGetUploadEntry.mockImplementation(async () => entry);
    mockCreateUploadSession.mockRejectedValue(new Error("session unavailable"));
    mockProcessUploadQueue.mockImplementationOnce(async (params) => {
      await params.handler(entry);
    });
    await expect(
      processAlbumUploadQueue({
        accountType: "student",
        ownerId: "viewer-id",
        queryClient: {} as never,
        userData: { id: "viewer-id", profileImage: "", username: "viewer" },
        viewerKey: "viewer-id",
      }),
    ).rejects.toThrow("session unavailable");
    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(mockUploadPhoto).not.toHaveBeenCalled();
  });

  it("clears cancelled-session checkpoints when one parallel upload fails", async () => {
    const entry = {
      attemptCount: 0,
      createdAt: "2026-03-13T00:00:00.000Z",
      id: "temp-album:partial-failure",
      kind: "album-photo",
      maxAttempts: 24,
      nextProcessAt: null,
      ownerId: "viewer-id",
      payload: {
        clientMutationId: "album-upload:partial-failure",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "file:///photo.jpg",
        images: ["file:///photo.jpg", "file:///video.mp4"],
        mediaKinds: ["image", "video"],
        uploaderUserId: "viewer-id",
      },
      status: "pending",
      updatedAt: "2026-03-13T00:00:00.000Z",
    };
    mockGetUploadEntry.mockImplementation(async () => entry);
    mockUploadFile.mockImplementation(async ({ uri }: { uri: string }) => {
      if (uri === "file:///photo.jpg") {
        return "albums/viewer-id/photo.webp";
      }
      throw new Error("video upload failed");
    });
    mockProcessUploadQueue.mockImplementationOnce(async (params) => {
      await params.handler(entry);
    });
    await expect(
      processAlbumUploadQueue({
        accountType: "student",
        ownerId: "viewer-id",
        queryClient: {} as never,
        userData: {
          id: "viewer-id",
          profileImage: "",
          username: "viewer",
        },
        viewerKey: "viewer-id",
      }),
    ).rejects.toThrow("video upload failed");
    expect(mockPatchUploadEntry).toHaveBeenCalledWith(
      "temp-album:partial-failure",
      expect.objectContaining({
        payload: expect.objectContaining({
          uploadedImages: ["", ""],
          uploadSessionId: null,
        }),
        status: "uploading",
      }),
    );
    expect(mockCancelUploadSession).toHaveBeenCalledWith("session-default", "token-1");
    expect(mockUploadPhoto).not.toHaveBeenCalled();
  });

  it("uses upload session tickets and finalizes the session after album creation", async () => {
    const entry = {
      attemptCount: 0,
      createdAt: "2026-03-13T00:00:00.000Z",
      id: "temp-album:session",
      kind: "album-photo",
      maxAttempts: 24,
      nextProcessAt: null,
      ownerId: "viewer-id",
      payload: {
        clientMutationId: "album-upload:session",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "file:///photo.jpg",
        images: ["file:///photo.jpg", "file:///video.mp4"],
        mediaKinds: ["image", "video"],
        uploaderUserId: "viewer-id",
      },
      status: "pending",
      updatedAt: "2026-03-13T00:00:00.000Z",
    };
    const tickets = [
      {
        mediaIndex: 0,
        path: "albums/viewer-id/album-upload-session-0.jpg",
        uploadUrl: "https://upload.example/0",
      },
      {
        mediaIndex: 1,
        path: "albums/viewer-id/album-upload-session-1.mp4",
        uploadUrl: "https://upload.example/1",
      },
    ];
    mockGetUploadEntry.mockImplementation(async () => entry);
    mockCreateUploadSession.mockResolvedValue({
      sessionId: "session-1",
      tickets,
    });
    mockUploadFile.mockImplementation(
      async (_file: unknown, _folder: unknown, options: { sessionTicket?: { path: string } }) =>
        options.sessionTicket?.path || "",
    );
    mockProcessUploadQueue.mockImplementationOnce(async (params) => {
      await params.handler(entry);
    });

    await processAlbumUploadQueue({
      accountType: "student",
      ownerId: "viewer-id",
      queryClient: {} as never,
      userData: {
        id: "viewer-id",
        profileImage: "",
        username: "viewer",
      },
      viewerKey: "viewer-id",
    });

    expect(mockCreateUploadSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "token-1",
        folder: "albums",
        mutationId: "album-upload:session",
        items: [
          expect.objectContaining({
            checksum: "a".repeat(64),
            contentType: "image/jpeg",
            expectedSizeBytes: 1_000,
            mediaIndex: 0,
          }),
          expect.objectContaining({
            checksum: "b".repeat(64),
            contentType: "video/mp4",
            expectedSizeBytes: 2_000,
            mediaIndex: 1,
          }),
        ],
      }),
    );
    expect(mockUploadFile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ uri: "file:///photo.jpg" }),
      "albums",
      expect.objectContaining({ sessionTicket: tickets[0] }),
    );
    expect(mockUploadFile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ uri: "file:///video.mp4" }),
      "albums",
      expect.objectContaining({ sessionTicket: tickets[1] }),
    );
    expect(mockFinalizeUploadSession).toHaveBeenCalledWith("session-1", "token-1");
    expect(mockCancelUploadSession).not.toHaveBeenCalled();
  });
});
