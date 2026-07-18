import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import {
  clearMutationActionQueueStorage,
  getMutationActionEntry,
} from "../../../data/queues/mutationActionQueue";
import { FollowAPI } from "../../../data/social";
import {
  processFollowRequestResolutionActionQueue,
  queueFollowRequestResolutionAction,
} from "./followRequestActionQueue";

jest.mock("../../../data/social", () => ({
  FollowAPI: {
    acceptRequest: jest.fn(),
    rejectRequest: jest.fn(),
  },
}));

jest.mock("./notificationsRequestState", () => ({
  applyFollowDecisionSideEffects: jest.fn(),
  rollbackOptimisticRequestResolution: jest.fn(),
}));

const { applyFollowDecisionSideEffects, rollbackOptimisticRequestResolution } = jest.requireMock(
  "./notificationsRequestState",
) as {
  applyFollowDecisionSideEffects: jest.Mock;
  rollbackOptimisticRequestResolution: jest.Mock;
};

describe("followRequestActionQueue", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await clearMutationActionQueueStorage();
  });

  it("processes queued follow request accept actions and applies success side effects", async () => {
    const queryClient = new QueryClient();
    await queueFollowRequestResolutionAction({
      action: "accept",
      clientMutationId: "follow-request-accept",
      notificationId: "notification-1",
      ownerId: "viewer-1",
      previousRead: false,
      previousUnreadCount: 4,
      requesterIdHint: "requester-1",
      requesterUsername: "fanzin",
      viewerKey: "viewer-1",
      viewerUsername: "viewer",
    });
    (FollowAPI.acceptRequest as jest.Mock).mockResolvedValue({ success: true });

    await processFollowRequestResolutionActionQueue({
      ownerId: "viewer-1",
      queryClient,
    });

    expect(FollowAPI.acceptRequest).toHaveBeenCalledWith(
      "fanzin",
      expect.objectContaining({
        clientMutationId: "follow-request-accept",
        notificationIdHint: "notification-1",
        requesterIdHint: "requester-1",
      }),
    );
    expect(applyFollowDecisionSideEffects).toHaveBeenCalled();
  });

  it("rolls back queued follow request actions on terminal failure", async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
    const queued = await queueFollowRequestResolutionAction({
      action: "reject",
      clientMutationId: "follow-request-reject",
      notificationId: "notification-1",
      ownerId: "viewer-1",
      previousRead: false,
      previousRequestResolvedAt: undefined,
      previousRequestStatus: "pending",
      previousUnreadCount: 2,
      requesterUsername: "fanzin",
      viewerKey: "viewer-1",
      viewerUsername: "viewer",
    });
    (FollowAPI.rejectRequest as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

    await processFollowRequestResolutionActionQueue({
      ownerId: "viewer-1",
      queryClient,
    });

    expect(rollbackOptimisticRequestResolution).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          previousRequestStatus: "pending",
          previousUnreadCount: 2,
        }),
        notificationId: "notification-1",
      }),
    );
    await expect(getMutationActionEntry(queued.id)).resolves.toEqual(
      expect.objectContaining({
        errorMessage: "Unauthorized",
        status: "failed",
      }),
    );
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
