import { QueryClient } from "@tanstack/react-query";
import type { AuthUserData } from "../../data/contracts/entities";
import {
  getRegisteredUploadQueueProcessors,
  resumeRegisteredUploadQueues,
} from "./uploadQueueRegistry";

jest.mock("../../features/profile/public/queues", () => {
  const process = jest.fn();
  return {
    __esModule: true,
    __profileUploadProcess: process,
    getProfileUploadQueueProcessors: () => [
      {
        id: "profile-update",
        process,
      },
    ],
  };
});

jest.mock("../../features/events/public/queues", () => {
  const createProcess = jest.fn();
  const albumProcess = jest.fn();
  return {
    __esModule: true,
    __eventCreateUploadProcess: createProcess,
    __albumUploadProcess: albumProcess,
    getEventUploadQueueProcessors: () => [
      {
        id: "events-create",
        process: createProcess,
      },
      {
        id: "albums-upload",
        process: albumProcess,
      },
    ],
  };
});

const { __profileUploadProcess } = jest.requireMock("../../features/profile/public/queues") as {
  __profileUploadProcess: jest.Mock;
};
const { __albumUploadProcess, __eventCreateUploadProcess } = jest.requireMock(
  "../../features/events/public/queues",
) as {
  __albumUploadProcess: jest.Mock;
  __eventCreateUploadProcess: jest.Mock;
};

describe("uploadQueueRegistry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exposes the registered upload processors", () => {
    expect(getRegisteredUploadQueueProcessors().map((processor) => processor.id)).toEqual([
      "profile-update",
      "events-create",
      "albums-upload",
    ]);
  });

  it("resumes every registered upload processor with the shared context", async () => {
    const queryClient = new QueryClient();
    const context = {
      accountType: "student" as const,
      ownerId: "viewer-1",
      queryClient,
      updateUserData: jest.fn(),
      userData: {
        id: "viewer-1",
        username: "viewer",
      } as AuthUserData,
      viewerKey: "viewer",
    };

    await resumeRegisteredUploadQueues(context);

    expect(__profileUploadProcess).toHaveBeenCalledWith(context);
    expect(__eventCreateUploadProcess).toHaveBeenCalledWith(context);
    expect(__albumUploadProcess).toHaveBeenCalledWith(context);
  });
});
