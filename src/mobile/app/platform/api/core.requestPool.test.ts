jest.mock("../observability", () => ({
  logEvent: jest.fn(),
}));

import { acquireApiRequestSlot, resetApiRequestSlotsForTests } from "./core.requestPool";

describe("API request backpressure", () => {
  beforeEach(() => {
    resetApiRequestSlotsForTests();
  });

  it("bounds concurrency and starts the next request after release", async () => {
    const releases = await Promise.all(Array.from({ length: 8 }, () => acquireApiRequestSlot()));
    let ninthStarted = false;
    const ninth = acquireApiRequestSlot().then((release) => {
      ninthStarted = true;
      return release;
    });

    await Promise.resolve();
    expect(ninthStarted).toBe(false);

    releases[0]?.();
    const ninthRelease = await ninth;
    expect(ninthStarted).toBe(true);

    ninthRelease();
    releases.slice(1).forEach((release) => release());
  });

  it("removes an aborted waiter without consuming a request slot", async () => {
    const releases = await Promise.all(Array.from({ length: 8 }, () => acquireApiRequestSlot()));
    const controller = new AbortController();
    const queued = acquireApiRequestSlot(controller.signal);

    controller.abort();
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });

    releases[0]?.();
    const nextRelease = await acquireApiRequestSlot();
    nextRelease();
    releases.slice(1).forEach((release) => release());
  });
});
