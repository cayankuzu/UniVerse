import { tokens } from "./tokens";

function luminance(hex: string) {
  const normalized = hex.replace("#", "");
  const channels = [0, 2, 4].map((start) => parseInt(normalized.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("UI tokens", () => {
  it("keeps the product touch target at the Android/iOS safe minimum", () => {
    expect(tokens.minHeight.touchTarget).toBeGreaterThanOrEqual(48);
    expect(tokens.minHeight.buttonSm).toBeGreaterThanOrEqual(48);
    expect(tokens.minHeight.row).toBeGreaterThanOrEqual(48);
  });

  it("keeps semantic text colors above WCAG normal-text contrast on white", () => {
    expect(contrast(tokens.colors.foreground, tokens.colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.colors.muted, tokens.colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.colors.primary, tokens.colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.colors.danger, tokens.colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.colors.successText, tokens.colors.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
