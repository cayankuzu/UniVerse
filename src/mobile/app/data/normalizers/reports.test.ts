jest.mock("../../platform/api/core", () => ({
  post: jest.fn(),
}));

import { post } from "../../platform/api/core";
import { ReportAPI } from "./reports";

const mockPost = post as jest.Mock;
const payload = {
  detail: "ayrinti",
  reason: "spam",
  targetId: "event-1",
  targetType: "event" as const,
};

describe("ReportAPI.submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ success: true });
  });

  it("preserves a caller-provided mutation key for safe retries", async () => {
    await ReportAPI.submit(payload, { clientMutationId: "report:retry-1234" });

    expect(mockPost).toHaveBeenCalledWith(
      "/reports",
      { ...payload, clientMutationId: "report:retry-1234" },
      { authMode: "required" },
    );
  });

  it("generates a valid mutation key for a new submission", async () => {
    await ReportAPI.submit(payload);

    expect(mockPost).toHaveBeenCalledWith(
      "/reports",
      expect.objectContaining({
        ...payload,
        clientMutationId: expect.stringMatching(/^report:[A-Za-z0-9-]{36}$/),
      }),
      { authMode: "required" },
    );
  });
});
