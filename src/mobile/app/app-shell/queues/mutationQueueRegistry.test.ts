import { QueryClient } from "@tanstack/react-query";
import {
  getRegisteredMutationQueueProcessors,
  resumeRegisteredMutationQueues,
} from "./mutationQueueRegistry";

jest.mock("../../features/events/public/queues", () => {
  const process = jest.fn();
  return {
    __esModule: true,
    __eventMutationProcess: process,
    getEventMutationQueueProcessors: () => [
      {
        id: "events-comment-create",
        process,
      },
    ],
  };
});

jest.mock("../../features/notifications/public/queues", () => {
  const process = jest.fn();
  return {
    __esModule: true,
    __notificationMutationProcess: process,
    getNotificationsMutationQueueProcessors: () => [
      {
        id: "notifications-follow-request-resolution",
        process,
      },
    ],
  };
});

jest.mock("../../features/profile/public/queues", () => {
  const process = jest.fn();
  return {
    __esModule: true,
    __profileMutationProcess: process,
    getProfileMutationQueueProcessors: () => [
      {
        id: "profile-follow-toggle",
        process,
      },
    ],
  };
});

const { __eventMutationProcess } = jest.requireMock("../../features/events/public/queues") as {
  __eventMutationProcess: jest.Mock;
};
const { __notificationMutationProcess } = jest.requireMock(
  "../../features/notifications/public/queues",
) as {
  __notificationMutationProcess: jest.Mock;
};
const { __profileMutationProcess } = jest.requireMock("../../features/profile/public/queues") as {
  __profileMutationProcess: jest.Mock;
};

describe("mutationQueueRegistry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes the registered mutation processors", () => {
    expect(getRegisteredMutationQueueProcessors().map((processor) => processor.id)).toEqual([
      "events-comment-create",
      "notifications-follow-request-resolution",
      "profile-follow-toggle",
    ]);
  });

  it("resumes every registered mutation processor with the shared context", async () => {
    const queryClient = new QueryClient();
    const context = {
      ownerId: "viewer-1",
      queryClient,
    };

    await resumeRegisteredMutationQueues(context);

    expect(__eventMutationProcess).toHaveBeenCalledWith(context);
    expect(__notificationMutationProcess).toHaveBeenCalledWith(context);
    expect(__profileMutationProcess).toHaveBeenCalledWith(context);
  });
});
