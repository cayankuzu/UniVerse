import {
  getResponsiveGridColumns,
  getResponsiveLayoutTokens,
  resolveWindowHeightClass,
  resolveWindowWidthClass,
} from "./responsive";

describe("responsive layout tokens", () => {
  it("resolves width and height classes for phone layouts", () => {
    expect(resolveWindowWidthClass(320)).toBe("compactNarrow");
    expect(resolveWindowWidthClass(390)).toBe("compact");
    expect(resolveWindowWidthClass(700)).toBe("medium");
    expect(resolveWindowHeightClass(568)).toBe("short");
    expect(resolveWindowHeightClass(844)).toBe("tall");
  });

  it("carries safe-area, keyboard, font scale and motion state", () => {
    const layout = getResponsiveLayoutTokens(320, 568, {
      fontScale: 2,
      insets: { bottom: 24, left: 8, top: 44 },
      keyboardHeight: 260,
      keyboardVisible: true,
      reduceMotion: true,
    });

    expect(layout.widthClass).toBe("compactNarrow");
    expect(layout.heightClass).toBe("short");
    expect(layout.fontScale).toBe(2);
    expect(layout.insets).toEqual({ bottom: 24, left: 8, right: 0, top: 44 });
    expect(layout.keyboardHeight).toBe(260);
    expect(layout.keyboardVisible).toBe(true);
    expect(layout.reduceMotion).toBe(true);
    expect(layout.spacing.edgeInset).toBeGreaterThanOrEqual(20);
  });

  it("does not force multi-column grids below the minimum item width", () => {
    expect(getResponsiveGridColumns(280)).toBe(1);
    expect(getResponsiveGridColumns(320)).toBe(2);
    expect(getResponsiveGridColumns(840, { tabletPortrait: 3 })).toBe(3);
  });
});
