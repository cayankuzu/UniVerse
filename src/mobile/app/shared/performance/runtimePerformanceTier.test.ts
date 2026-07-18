import {
  degradeRuntimePerformanceTier,
  getRuntimePerformanceTier,
  resetRuntimePerformanceTierForTests,
  resolveRuntimePerformanceTier,
} from "./runtimePerformanceTier";

describe("runtimePerformanceTier", () => {
  afterEach(() => {
    resetRuntimePerformanceTierForTests();
  });

  it("never lets a runtime pressure signal increase list work", () => {
    expect(resolveRuntimePerformanceTier("tier2", "tier1")).toBe("tier2");
    expect(resolveRuntimePerformanceTier("tier1", "tier3")).toBe("tier3");
    expect(resolveRuntimePerformanceTier("tier3", "tier2")).toBe("tier3");
  });

  it("accepts repeated degradation signals without throwing", () => {
    expect(() => {
      degradeRuntimePerformanceTier("tier2");
      degradeRuntimePerformanceTier("tier1");
      degradeRuntimePerformanceTier("tier3");
    }).not.toThrow();
    expect(getRuntimePerformanceTier()).toBe("tier3");
  });
});
