import { AppState } from "react-native";
import { resolveNetworkBudget, getNetworkQuality } from "./networkAwareBudget";

jest.mock("react-native", () => ({
  AppState: { currentState: "active" },
}));

describe("networkAwareBudget", () => {
  beforeEach(() => {
    (AppState as any).currentState = "active";
  });

  it("starts conservatively until the first native network state arrives", () => {
    const budget = resolveNetworkBudget("active");
    expect(budget.quality).toBe("unknown");
    expect(budget.allowIdlePrefetch).toBe(false);
    expect(budget.allowImagePrefetch).toBe(false);
    expect(budget.allowIntentPrefetch).toBe(true);
    expect(budget.allowNextPagePrefetch).toBe(false);
  });

  it("suppresses all prefetch when app is backgrounded", () => {
    const budget = resolveNetworkBudget("background");
    expect(budget.allowIdlePrefetch).toBe(false);
    expect(budget.allowImagePrefetch).toBe(false);
    expect(budget.allowIntentPrefetch).toBe(false);
    expect(budget.allowNextPagePrefetch).toBe(false);
  });

  it("suppresses all prefetch when app is inactive", () => {
    const budget = resolveNetworkBudget("inactive");
    expect(budget.allowIdlePrefetch).toBe(false);
    expect(budget.allowImagePrefetch).toBe(false);
    expect(budget.allowIntentPrefetch).toBe(false);
    expect(budget.allowNextPagePrefetch).toBe(false);
  });

  it("returns a budget object with all expected properties", () => {
    const budget = resolveNetworkBudget("active");
    expect(budget).toHaveProperty("allowIdlePrefetch");
    expect(budget).toHaveProperty("allowImagePrefetch");
    expect(budget).toHaveProperty("allowIntentPrefetch");
    expect(budget).toHaveProperty("allowNextPagePrefetch");
    expect(budget).toHaveProperty("quality");
  });

  it("getNetworkQuality returns a valid quality", () => {
    const quality = getNetworkQuality();
    expect(["good", "degraded", "offline", "unknown"]).toContain(quality);
  });
});
