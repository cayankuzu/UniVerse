import { hasNativePagerView, loadNativePagerView } from "./pagerViewAdapter";

describe("pagerViewAdapter", () => {
  it("detects either supported native view manager without leaking lookup errors", () => {
    expect(hasNativePagerView({})).toBe(false);
    expect(
      hasNativePagerView({
        getViewManagerConfig: (name) => (name === "RNCViewPager" ? {} : null),
      }),
    ).toBe(true);
    expect(
      hasNativePagerView({
        getViewManagerConfig: (name) => {
          if (name === "RNCViewPager") throw new Error("unavailable");
          return null;
        },
      }),
    ).toBe(false);
  });

  it("skips module loading when the native manager is unavailable", () => {
    const loadModule = jest.fn();

    expect(loadNativePagerView(loadModule, { getViewManagerConfig: () => null })).toBeNull();
    expect(loadModule).not.toHaveBeenCalled();
  });

  it("loads default and direct pager exports", () => {
    const DefaultPager = () => null;
    const DirectPager = () => null;
    const uiManager = { getViewManagerConfig: () => ({}) };

    expect(loadNativePagerView(() => ({ default: DefaultPager }), uiManager)).toBe(DefaultPager);
    expect(loadNativePagerView(() => DirectPager, uiManager)).toBe(DirectPager);
    expect(loadNativePagerView(() => ({}), uiManager)).toEqual({});
  });

  it("returns null for invalid or failing module exports", () => {
    const uiManager = { getViewManagerConfig: () => ({}) };

    expect(loadNativePagerView(() => "invalid", uiManager)).toBeNull();
    expect(
      loadNativePagerView(() => {
        throw new Error("missing module");
      }, uiManager),
    ).toBeNull();
  });
});
