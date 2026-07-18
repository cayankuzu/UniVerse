import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { EventAPI } from "../../../data/content/events.api";
import {
  clearUploadQueueStorage,
  getUploadEntry,
  getUploadQueue,
} from "../../../data/queues/uploadQueue";
import { StorageAPI } from "../../../data/storage/storage";
import {
  processEventCreateQueue,
  queueEventCreate,
  retryEventCreate,
  startQueuedEventCreate,
} from "./eventCreateQueueRepository";

const localEventShadow: Record<string, any>[] = [];

jest.mock("../../../data/content/events.api", () => ({
  EventAPI: {
    create: jest.fn(),
  },
}));

jest.mock("../../../data/storage/storage", () => ({
  StorageAPI: {
    uploadFile: jest.fn(),
  },
}));

jest.mock("../../../data/content/events/events.local", () => ({
  getAllLocalEventShadow: jest.fn(async () => [...localEventShadow]),
  patchLocalEventShadow: jest.fn(async (eventId: string, patch: Record<string, unknown>) => {
    const normalizedId = String(eventId || "").trim();
    let nextItem: Record<string, unknown> | null = null;
    for (let index = 0; index < localEventShadow.length; index += 1) {
      if (String(localEventShadow[index]?.id || "").trim() !== normalizedId) continue;
      nextItem = {
        ...localEventShadow[index],
        ...patch,
      };
      localEventShadow[index] = nextItem;
    }
    return nextItem;
  }),
  persistLocalEventShadow: jest.fn(async (item: Record<string, unknown>) => {
    const normalizedId = String(item?.id || "").trim();
    const nextItems = localEventShadow.filter(
      (entry) => String(entry?.id || "").trim() !== normalizedId,
    );
    localEventShadow.length = 0;
    localEventShadow.push(item, ...nextItems);
  }),
  removeLocalEventShadow: jest.fn(async (eventId: string) => {
    const normalizedId = String(eventId || "").trim();
    const nextItems = localEventShadow.filter(
      (entry) => String(entry?.id || "").trim() !== normalizedId,
    );
    localEventShadow.length = 0;
    localEventShadow.push(...nextItems);
  }),
  replaceLocalEventShadow: jest.fn(
    async (previousId: string, nextItem: Record<string, unknown>) => {
      const normalizedPreviousId = String(previousId || "").trim();
      const normalizedNextId = String(nextItem?.id || "").trim();
      const nextItems = localEventShadow.filter((entry) => {
        const entryId = String(entry?.id || "").trim();
        return entryId !== normalizedPreviousId && entryId !== normalizedNextId;
      });
      localEventShadow.length = 0;
      localEventShadow.push(nextItem, ...nextItems);
    },
  ),
}));

jest.mock("../../../data/projections/projections", () => ({
  prependProjectionItem: jest.fn(),
  removeProjectionItemIds: jest.fn(),
  replaceProjectionItemId: jest.fn(),
}));

function buildForm(overrides: Partial<Record<string, string>> = {}) {
  return {
    access: "Herkese Açık",
    address: "Adres 1",
    capacity: "120",
    description: "Detaylı açıklama",
    endDate: "2026-04-05",
    endTime: "20:00",
    fee: "Ücretsiz",
    feeAmount: "",
    level: "Tum seviyeler",
    location: "Istanbul",
    materials: "",
    startDate: "2026-04-05",
    startTime: "18:00",
    targetAudience: "Herkes",
    title: "Bahar Bulusmasi",
    type: "Seminer",
    ...overrides,
  };
}

function buildUserData(overrides: Partial<Record<string, string>> = {}) {
  return {
    clubName: "UniVerse Club",
    id: "viewer-1",
    name: "UniVerse Club",
    profileImage: "club-avatar.jpg",
    university: "UniVerse",
    username: "universeclub",
    ...overrides,
  };
}

function buildCreatedEvent(id: string, title: string, userData = buildUserData()) {
  return {
    access: "Herkese Açık",
    address: "Adres 1",
    attendees: 0,
    capacity: 120,
    categories: ["Teknoloji"],
    category: "Teknoloji",
    club: userData.clubName,
    clubImage: userData.profileImage,
    clubUserId: userData.id,
    clubUsername: userData.username,
    comments: 0,
    createdAt: "2026-04-01T10:00:00.000Z",
    date: "2026-04-05",
    description: "Detaylı açıklama",
    effectiveVisibility: "public",
    endDate: "2026-04-05",
    endTime: "20:00",
    fee: "Ücretsiz",
    id,
    image: "https://cdn.example.com/event-cover.jpg",
    joined: false,
    level: "Tum seviyeler",
    liked: false,
    likes: 0,
    location: "Istanbul",
    materials: "",
    startDate: "2026-04-05",
    startTime: "18:00",
    targetAudience: "Herkes",
    title,
    type: "Seminer",
    university: userData.university,
    visibility: "public",
  } as const;
}

async function waitForQueueDrain(entryId: string, ownerId?: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const currentEntry = await getUploadEntry(entryId);
    if (!currentEntry) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ownerQueue = await getUploadQueue("event-create", ownerId);
    if (!ownerQueue.find((entry) => entry.id === entryId)) {
      return;
    }
  }
  throw new Error(`Timed out waiting for upload entry ${entryId} to drain.`);
}

describe("eventCreateQueue", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    localEventShadow.length = 0;
    await AsyncStorage.clear();
    await clearUploadQueueStorage();
  });

  it("processes only the matching authenticated owner scope", async () => {
    const queryClient = new QueryClient();
    const viewerOne = buildUserData({ id: "viewer-1", username: "club-one" });
    const viewerTwo = buildUserData({ id: "viewer-2", username: "club-two" });

    await queueEventCreate({
      coverImageUri: "file:///cover-one.jpg",
      form: buildForm({ title: "Birinci Etkinlik" }),
      ownerId: "viewer-1",
      queryClient,
      selectedCategories: ["Teknoloji"],
      userData: viewerOne,
      viewerKey: "viewer-1",
    });
    await queueEventCreate({
      coverImageUri: "file:///cover-two.jpg",
      form: buildForm({ title: "İkinci Etkinlik" }),
      ownerId: "viewer-2",
      queryClient,
      selectedCategories: ["Tasarim"],
      userData: viewerTwo,
      viewerKey: "viewer-2",
    });

    (StorageAPI.uploadFile as jest.Mock).mockResolvedValue("https://cdn.example.com/cover-two.jpg");
    (EventAPI.create as jest.Mock).mockResolvedValue(
      buildCreatedEvent("event-2", "İkinci Etkinlik", viewerTwo),
    );

    await processEventCreateQueue({
      ownerId: "viewer-2",
      queryClient,
      viewerKey: "viewer-2",
    });

    expect(EventAPI.create).toHaveBeenCalledTimes(1);
    expect(EventAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "İkinci Etkinlik",
      }),
      expect.any(Object),
    );
    expect(await getUploadQueue("event-create", "viewer-1")).toHaveLength(1);
    expect(await getUploadQueue("event-create", "viewer-2")).toEqual([]);
  });

  it("retries a failed event create and replaces the optimistic shadow on success", async () => {
    const queryClient = new QueryClient();
    const userData = buildUserData();
    const queued = await queueEventCreate({
      coverImageUri: "file:///cover-retry.jpg",
      form: buildForm({ title: "Tekrar Denenecek" }),
      ownerId: "viewer-1",
      queryClient,
      selectedCategories: ["Teknoloji"],
      userData,
      viewerKey: "viewer-1",
    });

    (StorageAPI.uploadFile as jest.Mock).mockResolvedValue(
      "https://cdn.example.com/cover-retry.jpg",
    );
    (EventAPI.create as jest.Mock)
      .mockRejectedValueOnce(new Error("Unauthorized"))
      .mockResolvedValueOnce(buildCreatedEvent("event-retried", "Tekrar Denenecek", userData));

    await expect(
      processEventCreateQueue({
        entryId: queued.tempId,
        ownerId: "viewer-1",
        queryClient,
        viewerKey: "viewer-1",
      }),
    ).rejects.toThrow("Unauthorized");

    expect(await getUploadEntry(queued.tempId)).toEqual(
      expect.objectContaining({
        errorMessage: "Unauthorized",
        status: "failed",
      }),
    );
    expect(localEventShadow.find((item) => item.id === queued.tempId)).toEqual(
      expect.objectContaining({
        uploadError: "Unauthorized",
        uploadStatus: "failed",
      }),
    );

    await retryEventCreate({
      entryId: queued.tempId,
      ownerId: "viewer-1",
      queryClient,
      viewerKey: "viewer-1",
    });

    expect(await getUploadEntry(queued.tempId)).toBeNull();
    expect(localEventShadow.find((item) => item.id === queued.tempId)).toBeUndefined();
    expect(localEventShadow.find((item) => item.id === "event-retried")).toEqual(
      expect.objectContaining({
        title: "Tekrar Denenecek",
      }),
    );
  });

  it("hands event publishing off to background processing without blocking the caller", async () => {
    const queryClient = new QueryClient();
    const userData = buildUserData();
    let resolveUpload!: (value: string) => void;
    let uploadStarted = false;

    (StorageAPI.uploadFile as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          uploadStarted = true;
          resolveUpload = resolve as (value: string) => void;
        }),
    );
    (EventAPI.create as jest.Mock).mockResolvedValue(
      buildCreatedEvent("event-background", "Arka Plan Etkinligi", userData),
    );

    const queued = await startQueuedEventCreate({
      coverImageUri: "file:///cover-background.jpg",
      form: buildForm({ title: "Arka Plan Etkinligi" }),
      ownerId: "viewer-1",
      queryClient,
      selectedCategories: ["Topluluk"],
      userData,
      viewerKey: "viewer-1",
    });

    expect(queued.tempId).toContain("temp-event:");
    expect(await getUploadEntry(queued.tempId)).toEqual(
      expect.objectContaining({
        ownerId: "viewer-1",
      }),
    );
    for (let attempt = 0; attempt < 10 && !uploadStarted; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(StorageAPI.uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadStarted).toBe(true);

    resolveUpload("https://cdn.example.com/cover-background.jpg");
    await waitForQueueDrain(queued.tempId, "viewer-1");

    expect(await getUploadEntry(queued.tempId)).toBeNull();
    expect(localEventShadow.find((item) => item.id === "event-background")).toEqual(
      expect.objectContaining({
        title: "Arka Plan Etkinligi",
      }),
    );
  });

  it("preserves video upload metadata for event cover media", async () => {
    const queryClient = new QueryClient();
    const userData = buildUserData();
    const queued = await queueEventCreate({
      coverImageUri: "file:///cover-video.mp4",
      form: buildForm({ title: "Video Kapakli Etkinlik" }),
      ownerId: "viewer-1",
      queryClient,
      selectedCategories: ["Teknoloji"],
      userData,
      viewerKey: "viewer-1",
    });

    (StorageAPI.uploadFile as jest.Mock).mockResolvedValue(
      "https://cdn.example.com/cover-video.mp4",
    );
    (EventAPI.create as jest.Mock).mockResolvedValue(
      buildCreatedEvent("event-video", "Video Kapakli Etkinlik", userData),
    );

    await processEventCreateQueue({
      entryId: queued.tempId,
      ownerId: "viewer-1",
      queryClient,
      viewerKey: "viewer-1",
    });

    expect(StorageAPI.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/^event-cover-.*\.mp4$/),
        type: "video/mp4",
        uri: "file:///cover-video.mp4",
      }),
      "events",
    );
  });
});
