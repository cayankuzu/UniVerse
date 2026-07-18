import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { AlbumAPI } from "../../../data/content/albums.api";
import {
  clearMutationActionQueueStorage,
  getMutationActionQueue,
} from "../../../data/queues/mutationActionQueue";
import { EventAPI } from "../../../data/content/events.api";
import {
  processCommentCreateActionQueue,
  queueAlbumCommentCreateAction,
  queueEventCommentCreateAction,
} from "./commentCreateQueue";

jest.mock("../../../data/content/albums.api", () => ({
  AlbumAPI: {
    addPhotoComment: jest.fn(),
  },
}));

jest.mock("../../../data/content/events.api", () => ({
  EventAPI: {
    addComment: jest.fn(),
  },
}));

jest.mock("../../../data/content/albumMutationCache", () => ({
  refreshAlbumMutationScopes: jest.fn(),
}));

jest.mock("../../../data/content/eventMutationCache", () => ({
  refreshEventMutationScopes: jest.fn(),
}));

const mockAssertEventCommentCreateAllowed = jest.fn();
const mockAssertAlbumCommentCreateAllowed = jest.fn();

jest.mock("../../../data/social/blockedInteractionGuard", () => {
  const actual = jest.requireActual("../../../data/social/blockedInteractionGuard");
  return {
    ...actual,
    assertAlbumCommentCreateAllowed: (...args: unknown[]) =>
      mockAssertAlbumCommentCreateAllowed(...args),
    assertEventCommentCreateAllowed: (...args: unknown[]) =>
      mockAssertEventCommentCreateAllowed(...args),
  };
});

const { refreshAlbumMutationScopes } = jest.requireMock(
  "../../../data/content/albumMutationCache",
) as {
  refreshAlbumMutationScopes: jest.Mock;
};
const { refreshEventMutationScopes } = jest.requireMock(
  "../../../data/content/eventMutationCache",
) as {
  refreshEventMutationScopes: jest.Mock;
};

describe("commentCreateQueue", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAssertEventCommentCreateAllowed.mockResolvedValue("viewer-1");
    mockAssertAlbumCommentCreateAllowed.mockResolvedValue("viewer-1");
    await AsyncStorage.clear();
    await clearMutationActionQueueStorage();
  });

  it("processes queued event comments in the background and refreshes event scopes", async () => {
    const queryClient = new QueryClient();
    await queueEventCommentCreateAction({
      eventId: "event-1",
      optimisticCommentId: "local-1",
      parentId: null,
      text: "Merhaba",
    });
    (EventAPI.addComment as jest.Mock).mockResolvedValue({ id: "comment-1" });

    await processCommentCreateActionQueue({ queryClient });

    expect(EventAPI.addComment).toHaveBeenCalledWith(
      "event-1",
      "Merhaba",
      null,
      expect.objectContaining({
        clientMutationId: expect.any(String),
      }),
    );
    expect(refreshEventMutationScopes).toHaveBeenCalledWith(queryClient, "event-1");
  });

  it("processes queued album comments in the background and refreshes album scopes", async () => {
    const queryClient = new QueryClient();
    await queueAlbumCommentCreateAction({
      eventId: "event-1",
      optimisticCommentId: "local-1",
      parentId: null,
      photoId: "photo-1",
      text: "Albüm yorumu",
    });
    (AlbumAPI.addPhotoComment as jest.Mock).mockResolvedValue({ id: "comment-1" });

    await processCommentCreateActionQueue({ queryClient });

    expect(AlbumAPI.addPhotoComment).toHaveBeenCalledWith(
      "photo-1",
      "Albüm yorumu",
      null,
      expect.objectContaining({
        clientMutationId: expect.any(String),
      }),
    );
    expect(refreshAlbumMutationScopes).toHaveBeenCalledWith(queryClient, "event-1");
  });

  it("rejects blocked event comments before they enter the queue", async () => {
    mockAssertEventCommentCreateAllowed.mockRejectedValue(
      new Error("Blocked interaction forbidden."),
    );

    await expect(
      queueEventCommentCreateAction({
        eventId: "event-1",
        optimisticCommentId: "local-blocked",
        parentId: null,
        text: "Merhaba",
      }),
    ).rejects.toThrow("Blocked interaction forbidden.");

    await expect(getMutationActionQueue("event-comment-create")).resolves.toEqual([]);
  });
});
