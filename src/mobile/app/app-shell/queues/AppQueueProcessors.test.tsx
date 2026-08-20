import React from "react";
import { render } from "@testing-library/react-native";
import { getMutationActionQueue } from "../../data/queues/mutationActionQueue";
import { getUploadQueue } from "../../data/queues/uploadQueue";
import { AppMutationQueueProcessor } from "./AppMutationQueueProcessor";
import { AppUploadQueueProcessor } from "./AppUploadQueueProcessor";
import { resumeRegisteredMutationQueues } from "./mutationQueueRegistry";
import { resumeRegisteredUploadQueues } from "./uploadQueueRegistry";

const mockQueryClient = { invalidateQueries: jest.fn() };
const mockUpdateUserData = jest.fn();
let mockProcessorParams: {
  lane: string;
  ownerId: string;
  readStats: () => Promise<{
    failedCount: number;
    oldestPendingAgeMs: number;
    pendingCount: number;
  }>;
  resume: () => Promise<void>;
} | null = null;

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));
jest.mock("../auth", () => ({
  useAuth: () => ({
    accountType: "student",
    updateUserData: mockUpdateUserData,
    userData: { id: "owner-1", username: "owner" },
  }),
}));
jest.mock("../../data/contracts/viewerKey", () => ({
  getViewerKey: () => "viewer-key",
}));
jest.mock("../../data/queues/mutationActionQueue", () => ({
  getMutationActionQueue: jest.fn(),
}));
jest.mock("../../data/queues/uploadQueue", () => ({
  getUploadQueue: jest.fn(),
}));
jest.mock("./mutationQueueRegistry", () => ({
  resumeRegisteredMutationQueues: jest.fn(async () => undefined),
}));
jest.mock("./uploadQueueRegistry", () => ({
  resumeRegisteredUploadQueues: jest.fn(async () => undefined),
}));
jest.mock("./usePersistentQueueProcessor", () => ({
  usePersistentQueueProcessor: (params: typeof mockProcessorParams) => {
    mockProcessorParams = params;
  },
}));

const mockGetMutationActionQueue = getMutationActionQueue as jest.Mock;
const mockGetUploadQueue = getUploadQueue as jest.Mock;
const mockResumeRegisteredMutationQueues = resumeRegisteredMutationQueues as jest.Mock;
const mockResumeRegisteredUploadQueues = resumeRegisteredUploadQueues as jest.Mock;

describe("persistent app queue processors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    mockProcessorParams = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("derives upload backlog stats and resumes the registered owner queue", async () => {
    mockGetUploadQueue.mockResolvedValue([
      { createdAt: "2026-08-19T11:59:58.000Z", status: "uploading" },
      { createdAt: "2026-08-19T11:59:59.000Z", status: "pending" },
      { createdAt: "2026-08-19T11:59:57.000Z", status: "failed" },
    ]);

    render(<AppUploadQueueProcessor />);
    expect(mockProcessorParams).toMatchObject({ lane: "upload", ownerId: "owner-1" });

    await expect(mockProcessorParams?.readStats()).resolves.toEqual({
      failedCount: 1,
      oldestPendingAgeMs: 2_000,
      pendingCount: 2,
    });
    await mockProcessorParams?.resume();
    expect(mockResumeRegisteredUploadQueues).toHaveBeenCalledWith({
      accountType: "student",
      ownerId: "owner-1",
      queryClient: mockQueryClient,
      updateUserData: mockUpdateUserData,
      userData: { id: "owner-1", username: "owner" },
      viewerKey: "viewer-key",
    });
  });

  it("derives mutation backlog stats and resumes the registered owner queue", async () => {
    mockGetMutationActionQueue.mockResolvedValue([
      { createdAt: "2026-08-19T11:59:57.000Z", status: "running" },
      { createdAt: "2026-08-19T11:59:59.000Z", status: "pending" },
      { createdAt: "2026-08-19T11:59:55.000Z", status: "failed" },
    ]);

    render(<AppMutationQueueProcessor />);
    expect(mockProcessorParams).toMatchObject({ lane: "mutation", ownerId: "owner-1" });

    await expect(mockProcessorParams?.readStats()).resolves.toEqual({
      failedCount: 1,
      oldestPendingAgeMs: 3_000,
      pendingCount: 2,
    });
    await mockProcessorParams?.resume();
    expect(mockResumeRegisteredMutationQueues).toHaveBeenCalledWith({
      ownerId: "owner-1",
      queryClient: mockQueryClient,
    });
  });
});
