import { recordTelemetry } from "../telemetry";
import { Sentry } from "./sentry";
import { logError } from "./index";

jest.mock("../telemetry", () => ({
  recordTelemetry: jest.fn(),
  startTelemetryTimer: jest.fn(),
}));

jest.mock("./sentry", () => ({
  Sentry: {
    captureException: jest.fn(),
  },
}));

describe("observability facade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs sanitized error telemetry and captures the exception", () => {
    const error = new Error("Bearer secret-token user@example.com");
    logError(error, {
      meta: {
        nested: { refresh_token: "token" },
        operation: "profile-load",
        scope: "profile-screen",
        token: "leak-me",
      },
      name: "projection-error",
      screenKey: "profile?access_token=secret",
    });

    expect(recordTelemetry).toHaveBeenCalledWith({
      category: "error",
      meta: {
        message: "Bearer [redacted] us***@example.com",
        nested: {
          refresh_token: "[redacted]",
        },
        operation: "profile-load",
        scope: "profile-screen",
        token: "[redacted]",
      },
      name: "projection-error",
      screenKey: "profile?access_token=[redacted]",
      status: "error",
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: {
        nested: {
          refresh_token: "[redacted]",
        },
        operation: "profile-load",
        scope: "profile-screen",
        screenKey: "profile?access_token=[redacted]",
        token: "[redacted]",
      },
      tags: {
        category: "error",
        operation: "profile-load",
        scope: "profile-screen",
      },
    });
  });

  it("dedupes repeated errors inside the same window", () => {
    const error = new Error("repeat-me");

    logError(error, { name: "repeatable-error", screenKey: "home" });
    logError(error, { name: "repeatable-error", screenKey: "home" });

    expect(recordTelemetry).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
