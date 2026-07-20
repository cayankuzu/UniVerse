import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearMutationActionQueueStorage,
  getMutationActionQueue,
} from "../queues/mutationActionQueue";
import {
  queueOrReplaceEventLikeToggleAction,
  queueAlbumLikeToggleAction,
  queueEventAttendanceToggleAction,
  queueEventLikeToggleAction,
} from "./contentToggleQueue.enqueue";

const mockAssertEventInteractionAllowed = jest.fn();
const mockAssertAlbumInteractionAllowed = jest.fn();

jest.mock("../social/blockedInteractionGuard", () => {
  const actual = jest.requireActual("../social/blockedInteractionGuard");
  return {
    ...actual,
    assertAlbumInteractionAllowed: (...args: unknown[]) =>
      mockAssertAlbumInteractionAllowed(...args),
    assertEventInteractionAllowed: (...args: unknown[]) =>
      mockAssertEventInteractionAllowed(...args),
  };
});

describe("contentToggleQueue enqueue blocking", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAssertEventInteractionAllowed.mockResolvedValue("viewer-1");
    mockAssertAlbumInteractionAllowed.mockResolvedValue("viewer-1");
    await AsyncStorage.clear();
    await clearMutationActionQueueStorage();
  });

  it("rejects blocked event like toggles before queueing", async () => {
    mockAssertEventInteractionAllowed.mockRejectedValue(
      new Error("Blocked interaction forbidden."),
    );

    await expect(
      queueEventLikeToggleAction({
        eventId: "event-1",
        previousCount: 0,
        previousLiked: false,
        targetLiked: true,
      }),
    ).rejects.toThrow("Blocked interaction forbidden.");

    await expect(getMutationActionQueue("event-like-toggle")).resolves.toEqual([]);
  });

  it("rejects blocked event attendance toggles before queueing", async () => {
    mockAssertEventInteractionAllowed.mockRejectedValue(
      new Error("Blocked interaction forbidden."),
    );

    await expect(
      queueEventAttendanceToggleAction({
        eventId: "event-1",
        previousCount: 4,
        previousJoined: false,
        targetJoined: true,
      }),
    ).rejects.toThrow("Blocked interaction forbidden.");

    await expect(getMutationActionQueue("event-attendance-toggle")).resolves.toEqual([]);
  });

  it("rejects blocked album like toggles before queueing", async () => {
    mockAssertAlbumInteractionAllowed.mockRejectedValue(
      new Error("Blocked interaction forbidden."),
    );

    await expect(
      queueAlbumLikeToggleAction({
        photoId: "photo-1",
        previousCount: 0,
        previousLiked: false,
        targetLiked: true,
      }),
    ).rejects.toThrow("Blocked interaction forbidden.");

    await expect(getMutationActionQueue("album-like-toggle")).resolves.toEqual([]);
  });

  it("atomically coalesces rapid toggles while preserving the authoritative rollback baseline", async () => {
    const first = await queueOrReplaceEventLikeToggleAction({
      clientMutationId: "like-1",
      eventId: "event-1",
      ownerId: "viewer-1",
      previousCount: 8,
      previousLiked: false,
      targetLiked: true,
    });
    const second = await queueOrReplaceEventLikeToggleAction({
      clientMutationId: "like-2",
      eventId: "event-1",
      ownerId: "viewer-1",
      previousCount: 9,
      previousLiked: true,
      targetLiked: false,
    });

    expect(first.replaced).toBe(false);
    expect(second.replaced).toBe(true);
    expect(second.entry.payload).toEqual({
      clientMutationId: "like-2",
      eventId: "event-1",
      previousCount: 8,
      previousLiked: false,
      targetLiked: false,
    });
    await expect(getMutationActionQueue("event-like-toggle", "viewer-1")).resolves.toHaveLength(1);
  });
});
