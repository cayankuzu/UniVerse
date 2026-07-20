jest.mock("../../data/projections/networkAwareBudget", () => ({
  resolveNetworkBudget: () => ({ allowImagePrefetch: true, quality: "good" }),
}));

import { resolveWarmupIdleBudget } from "./appWarmupBudget";

function createBundle(source: "rpc" | "timeout-backpressure") {
  return {
    home: { items: source === "timeout-backpressure" ? [] : [{ id: "1" }] },
    source,
  } as any;
}

describe("resolveWarmupIdleBudget", () => {
  it("disables idle warmup while the app is backgrounded", () => {
    expect(
      resolveWarmupIdleBudget({
        appState: "background",
        bundle: createBundle("rpc"),
      }),
    ).toMatchObject({
      allowIdle: false,
      maxImages: 0,
    });
  });

  it("allows a small sequential media batch after a healthy RPC warmup", () => {
    expect(
      resolveWarmupIdleBudget({
        appState: "active",
        bundle: createBundle("rpc"),
      }),
    ).toMatchObject({
      allowIdle: true,
      maxImages: 3,
    });
  });

  it("skips low-priority idle work under timeout backpressure", () => {
    expect(
      resolveWarmupIdleBudget({
        appState: "active",
        bundle: createBundle("timeout-backpressure"),
      }),
    ).toMatchObject({
      allowIdle: false,
      maxImages: 0,
    });
  });
});
