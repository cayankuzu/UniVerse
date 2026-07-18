import type { EventDetailProjection } from "../../../data/projections/projections.types";
import { getUploadQueue, patchUploadEntry } from "../../../data/queues/uploadQueue";
import {
  createPendingAlbumUpload,
  listPendingAlbumPhotos,
  mapAlbumUploadEntryToPendingPhoto,
} from "./albumUploadQueueRepository";

jest.mock("../../../data/queues/uploadQueue", () => ({
  enqueueUpload: jest.fn(),
  getUploadEntry: jest.fn(),
  getUploadQueue: jest.fn(),
  patchUploadEntry: jest.fn(async (_entryId: string, patch: unknown) => patch),
  processUploadQueue: jest.fn(),
  removeUploadEntry: jest.fn(),
  retryUploadEntry: jest.fn(),
}));

const mockGetUploadQueue = getUploadQueue as jest.Mock;
const mockPatchUploadEntry = patchUploadEntry as jest.Mock;

describe("albumUploadQueueRepository", () => {
  const event = {
    clubUsername: "universeclub",
    title: "Bahar Etkinligi",
  } as unknown as EventDetailProjection["event"];

  const userData = {
    clubName: "UniVerse Club",
    id: "viewer-1",
    name: "UniVerse Club",
    profileImage: "club-avatar.jpg",
    username: "universeclub",
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a pending album upload with normalized image payload", () => {
    const { payload, pendingPhoto } = createPendingAlbumUpload({
      caption: "Aciklama",
      event,
      eventId: "event-1",
      images: [" file:///one.jpg ", "", "file:///two.jpg"],
      showOnClubProfile: true,
      showOnOwnProfile: false,
      title: "Album Basligi",
      userData,
      baseTime: 1710000000000,
    });

    expect(payload.images).toEqual(["file:///one.jpg", "file:///two.jpg"]);
    expect(pendingPhoto.id).toContain("temp-album:1710000000000:");
    expect(pendingPhoto.image).toBe("file:///one.jpg");
    expect(pendingPhoto.photoCount).toBe(2);
    expect(pendingPhoto.showOnClubProfile).toBe(true);
    expect(pendingPhoto.showOnOwnProfile).toBe(true);
  });

  it("maps stored queue entries into pending album cards with failed state", () => {
    const pendingPhoto = mapAlbumUploadEntryToPendingPhoto({
      createdAt: "2026-03-20T10:00:00.000Z",
      entryId: "temp-album:1",
      errorMessage: "Upload failed.",
      event,
      eventId: "event-1",
      payload: {
        caption: "Aciklama",
        eventId: "event-1",
        eventTitle: "Bahar Etkinligi",
        image: "file:///one.jpg",
        images: ["file:///one.jpg"],
        showOnClubProfile: false,
        showOnOwnProfile: true,
        title: "Album Basligi",
      },
      status: "failed",
      userData,
    });

    expect(pendingPhoto.uploadStatus).toBe("failed");
    expect(pendingPhoto.uploadError).toBe("Upload failed.");
    expect(pendingPhoto.showOnOwnProfile).toBe(true);
    expect(pendingPhoto.title).toBe("Album Basligi");
  });

  it("converts legacy Android file access failures into a clear album retry message", () => {
    const pendingPhoto = mapAlbumUploadEntryToPendingPhoto({
      createdAt: "2026-03-20T10:00:00.000Z",
      entryId: "temp-album:2",
      errorMessage: "Upload failed.",
      event,
      eventId: "event-1",
      payload: {
        eventId: "event-1",
        eventTitle: "Bahar Etkinligi",
        image: "file:///storage/emulated/0/DCIM/Camera/legacy.jpg",
        images: ["file:///storage/emulated/0/DCIM/Camera/legacy.jpg"],
      },
      status: "failed",
      userData,
    });

    expect(pendingPhoto.uploadError).toBe(
      "Secilen medya dosyasina Android galerisi uzerinden erisilemiyor. Karti silip medyayi galeriden yeniden sec.",
    );
  });

  it("relabels generic unauthorized Android gallery failures with the media access root cause", () => {
    const pendingPhoto = mapAlbumUploadEntryToPendingPhoto({
      createdAt: "2026-03-20T10:00:00.000Z",
      entryId: "temp-album:3",
      errorMessage: "Unauthorized",
      event,
      eventId: "event-1",
      payload: {
        eventId: "event-1",
        eventTitle: "Bahar Etkinligi",
        image: "content://media/external/images/media/42",
        images: ["content://media/external/images/media/42"],
      },
      status: "failed",
      userData,
    });

    expect(pendingPhoto.uploadError).toBe(
      "Secilen medya dosyasina Android galerisi uzerinden erisilemiyor. Karti silip medyayi galeriden yeniden sec.",
    );
  });

  it("auto-recovers legacy failed auth album uploads when listing pending cards", async () => {
    const failedEntry = {
      attemptCount: 4,
      createdAt: "2026-03-20T10:00:00.000Z",
      errorMessage: "Oturum dogrulanamadi. Uygulamayi yeniden acip tekrar dene.",
      id: "temp-album:auth",
      kind: "album-photo",
      maxAttempts: 4,
      nextProcessAt: null,
      ownerId: "viewer-1",
      payload: {
        eventId: "event-1",
        eventTitle: "Bahar Etkinligi",
        image: "file:///app/album-photo.jpg",
        images: ["file:///app/album-photo.jpg"],
      },
      status: "failed",
      updatedAt: "2026-03-20T10:05:00.000Z",
    };
    const recoveredEntry = {
      ...failedEntry,
      errorMessage: undefined,
      payload: {
        ...failedEntry.payload,
        authFailureAutoRetriedAt: "2026-03-20T10:06:00.000Z",
      },
      status: "pending",
    };
    mockGetUploadQueue.mockResolvedValueOnce([failedEntry]).mockResolvedValueOnce([recoveredEntry]);

    const pendingPhotos = await listPendingAlbumPhotos({
      event,
      eventId: "event-1",
      ownerId: "viewer-1",
      userData,
    });

    expect(mockPatchUploadEntry).toHaveBeenCalledWith(
      "temp-album:auth",
      expect.objectContaining({
        attemptCount: 0,
        errorMessage: undefined,
        payload: expect.objectContaining({
          authFailureAutoRetriedAt: expect.any(String),
        }),
        status: "pending",
      }),
    );
    expect(pendingPhotos[0]).toMatchObject({
      id: "temp-album:auth",
      uploadStatus: "pending",
    });
  });

  it("does not auto-retry Android gallery media access failures", async () => {
    mockGetUploadQueue.mockResolvedValueOnce([
      {
        attemptCount: 4,
        createdAt: "2026-03-20T10:00:00.000Z",
        errorMessage: "Unauthorized",
        id: "temp-album:media",
        kind: "album-photo",
        maxAttempts: 4,
        nextProcessAt: null,
        ownerId: "viewer-1",
        payload: {
          eventId: "event-1",
          eventTitle: "Bahar Etkinligi",
          image: "content://media/external/images/media/42",
          images: ["content://media/external/images/media/42"],
        },
        status: "failed",
        updatedAt: "2026-03-20T10:05:00.000Z",
      },
    ]);

    const pendingPhotos = await listPendingAlbumPhotos({
      event,
      eventId: "event-1",
      ownerId: "viewer-1",
      userData,
    });

    expect(mockPatchUploadEntry).not.toHaveBeenCalled();
    expect(pendingPhotos[0]).toMatchObject({
      id: "temp-album:media",
      uploadStatus: "failed",
    });
  });

  it("does not auto-retry the same auth failure more than once", async () => {
    mockGetUploadQueue.mockResolvedValueOnce([
      {
        attemptCount: 4,
        createdAt: "2026-03-20T10:00:00.000Z",
        errorMessage: "Unauthorized",
        id: "temp-album:auth-once",
        kind: "album-photo",
        maxAttempts: 4,
        nextProcessAt: null,
        ownerId: "viewer-1",
        payload: {
          authFailureAutoRetriedAt: "2026-03-20T10:06:00.000Z",
          eventId: "event-1",
          eventTitle: "Bahar Etkinligi",
          image: "file:///app/album-photo.jpg",
          images: ["file:///app/album-photo.jpg"],
        },
        status: "failed",
        updatedAt: "2026-03-20T10:05:00.000Z",
      },
    ]);

    const pendingPhotos = await listPendingAlbumPhotos({
      event,
      eventId: "event-1",
      ownerId: "viewer-1",
      userData,
    });

    expect(mockPatchUploadEntry).not.toHaveBeenCalled();
    expect(pendingPhotos[0]).toMatchObject({
      id: "temp-album:auth-once",
      uploadStatus: "failed",
    });
  });
});
