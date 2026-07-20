import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import {
  clearMutationActionQueueStorage,
  getMutationActionEntry,
} from "../queues/mutationActionQueue";
import { queueOrReplaceEventLikeToggleAction } from "./contentToggleQueue.enqueue";
import { processContentToggleQueue } from "./contentToggleQueue.process";
import { likeEvent } from "./events.interactions";
import { patchResolvedEventLikeCache } from "./contentToggleQueue.shared";

jest.mock("./events.interactions", () => ({
  attendEvent: jest.fn(),
  likeEvent: jest.fn(),
}));

jest.mock("./albums.interactions", () => ({
  likeAlbumPhoto: jest.fn(),
}));

jest.mock("./contentToggleQueue.shared", () => {
  const actual = jest.requireActual("./contentToggleQueue.shared");
  return {
    ...actual,
    patchResolvedAlbumLikeCache: jest.fn(),
    patchResolvedEventAttendanceCache: jest.fn(),
    patchResolvedEventLikeCache: jest.fn(),
  };
});

jest.mock("../social/blockedInteractionGuard", () => ({
  assertAlbumInteractionAllowed: jest.fn().mockResolvedValue("viewer-1"),
  assertEventInteractionAllowed: jest.fn().mockResolvedValue("viewer-1"),
}));

describe("contentToggleQueue processing", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await clearMutationActionQueueStorage();
  });

  it("does not overwrite a newer optimistic intent with a superseded server response", async () => {
    const queryClient = new QueryClient();
    await queueOrReplaceEventLikeToggleAction({
      clientMutationId: "like-first",
      eventId: "event-1",
      ownerId: "viewer-1",
      previousCount: 4,
      previousLiked: false,
      targetLiked: true,
    });

    let resolveFirst: (value: { count: number; liked: boolean }) => void = () => {};
    (likeEvent as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ count: 4, liked: false });

    const processing = processContentToggleQueue({
      ownerId: "viewer-1",
      queryClient,
    });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const entry = await getMutationActionEntry("event-like:event-1");
      if (entry?.status === "running") break;
      await Promise.resolve();
    }

    await queueOrReplaceEventLikeToggleAction({
      clientMutationId: "like-final",
      eventId: "event-1",
      ownerId: "viewer-1",
      previousCount: 5,
      previousLiked: true,
      targetLiked: false,
    });
    resolveFirst({ count: 5, liked: true });
    await processing;

    expect(likeEvent).toHaveBeenCalledTimes(2);
    expect(patchResolvedEventLikeCache).toHaveBeenCalledTimes(1);
    expect(patchResolvedEventLikeCache).toHaveBeenCalledWith(
      queryClient,
      expect.objectContaining({ targetLiked: false }),
      { count: 4, liked: false },
    );
  });
});
