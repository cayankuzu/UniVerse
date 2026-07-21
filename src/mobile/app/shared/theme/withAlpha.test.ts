import { withAlpha } from "./withAlpha";

describe("withAlpha", () => {
  it("creates bounded rgba colors from theme hex values", () => {
    expect(withAlpha("#0f172a", 0.18)).toBe("rgba(15,23,42,0.18)");
    expect(withAlpha("#ffffff", 4)).toBe("rgba(255,255,255,1)");
    expect(withAlpha("#000000", -1)).toBe("rgba(0,0,0,0)");
  });

  it("leaves unsupported color formats unchanged", () => {
    expect(withAlpha("transparent", 0.5)).toBe("transparent");
  });
});
