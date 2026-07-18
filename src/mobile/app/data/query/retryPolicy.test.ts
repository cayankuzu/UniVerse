import { getQueryRetryDelay, isRetryableQueryError, shouldRetryQuery } from "./retryPolicy";

describe("query retry policy", () => {
  it("adds bounded deterministic jitter to exponential backoff", () => {
    const random = jest.spyOn(Math, "random").mockReturnValue(0.5);

    expect(getQueryRetryDelay(0)).toBe(600);
    expect(getQueryRetryDelay(3)).toBe(2_500);
    expect(random).toHaveBeenCalledTimes(2);
    random.mockRestore();
  });

  it("retries transient failures at most twice", () => {
    expect(isRetryableQueryError({ status: 429 })).toBe(true);
    expect(isRetryableQueryError(new Error("network request failed"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("offline"))).toBe(true);
    expect(shouldRetryQuery(2, new Error("offline"))).toBe(false);
    expect(isRetryableQueryError({ status: 401 })).toBe(false);
  });
});
