import { HttpRequestError } from "../../platform/api/core.requestHelpers";
import { isRetryableQueueError } from "./queueErrorPolicy";

describe("isRetryableQueueError", () => {
  it("retries rate limits and server failures but not terminal client errors", () => {
    expect(
      isRetryableQueueError(new HttpRequestError("rate limited", 429), { useHttpStatus: true }),
    ).toBe(true);
    expect(
      isRetryableQueueError(new HttpRequestError("unavailable", 503), { useHttpStatus: true }),
    ).toBe(true);
    expect(
      isRetryableQueueError(new HttpRequestError("invalid", 422), { useHttpStatus: true }),
    ).toBe(false);
  });
});
