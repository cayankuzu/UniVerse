import React from "react";
import { render } from "@testing-library/react-native";
import { AppUploadQueueProcessor } from "./AppUploadQueueProcessor";
import { getUploadQueue } from "../../data/queues/uploadQueue";
import { resumeRegisteredUploadQueues } from "./uploadQueueRegistry";
import { subscribeQueueResumeSignal } from "../../data/queues/runtimeSignals";

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));
jest.mock("../auth", () => ({
  useAuth: () => ({
    accountType: "student",
    updateUserData: jest.fn(),
    userData: { id: "", username: "" },
  }),
}));
jest.mock("../../data/contracts/viewerKey", () => ({
  getViewerKey: () => "anonymous",
}));
jest.mock("../../data/queues/uploadQueue", () => ({
  getUploadQueue: jest.fn(),
}));
jest.mock("./uploadQueueRegistry", () => ({
  resumeRegisteredUploadQueues: jest.fn(),
}));
jest.mock("../../data/queues/runtimeSignals", () => ({
  subscribeQueueResumeSignal: jest.fn(),
}));
jest.mock("./queueResumeScheduler", () => ({
  getStableQueueJitterMs: jest.fn(() => 0),
  scheduleQueueProcessorResume: jest.fn(),
}));
jest.mock("../../platform/observability", () => ({
  logEvent: jest.fn(),
}));

describe("AppUploadQueueProcessor", () => {
  it("stays idle until an authenticated upload owner exists", () => {
    const screen = render(<AppUploadQueueProcessor />);

    expect(screen.toJSON()).toBeNull();
    expect(getUploadQueue).not.toHaveBeenCalled();
    expect(resumeRegisteredUploadQueues).not.toHaveBeenCalled();
    expect(subscribeQueueResumeSignal).not.toHaveBeenCalled();
  });
});
