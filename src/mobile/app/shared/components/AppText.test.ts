import { tokens } from "../theme";
import { getAppTextVariantStyle } from "./AppText";

describe("AppText typography roles", () => {
  it("uses the loaded Inter families for reusable text roles", () => {
    expect(getAppTextVariantStyle("body").fontFamily).toBe(tokens.fontFamily.regular);
    expect(getAppTextVariantStyle("label").fontFamily).toBe(tokens.fontFamily.semibold);
    expect(getAppTextVariantStyle("pageTitle").fontFamily).toBe(tokens.fontFamily.bold);
  });

  it("uses the compact metadata role without dropping below ten pixels", () => {
    expect(getAppTextVariantStyle("meta").fontSize).toBe(tokens.typography.caption);
    expect(Number(getAppTextVariantStyle("meta").fontSize)).toBeGreaterThanOrEqual(10);
  });
});
