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
  it("keeps compact controls inside an accessible 48dp interaction target", () => {
    expect(tokens.minHeight.touchTarget).toBeGreaterThanOrEqual(48);
    expect(tokens.minHeight.buttonSm).toBeLessThan(tokens.minHeight.touchTarget);
    expect(tokens.minHeight.buttonLg).toBeLessThanOrEqual(44);
    expect(tokens.minHeight.row).toBeGreaterThanOrEqual(44);
  });

  it("uses the compact two-step product density scale", () => {
    expect(tokens.typography.body).toBe(12);
    expect(tokens.spacing.md).toBe(12);
    expect(tokens.iconSize.xl).toBe(18);
  });

  // A screen can put any of these three layers behind body copy, so a text token
  // is only safe when its *worst* pairing clears AA. Anything below stays an
  // icon-weight token and check-text-contrast.cjs keeps it out of copy.
  const LIGHT_LAYERS = [
    tokens.colors.surface,
    tokens.colors.background,
    tokens.colors.surfaceVariant,
  ] as const;

  function worstContrast(foreground: string) {
    return Math.min(...LIGHT_LAYERS.map((layer) => contrast(foreground, layer)));
  }

  it.each([
    ["foreground", tokens.colors.foreground],
    ["text", tokens.colors.text],
    ["textStrong", tokens.colors.textStrong],
    ["textSecondary", tokens.colors.textSecondary],
    ["muted", tokens.colors.muted],
    ["mutedFg", tokens.colors.mutedFg],
    ["textSubtle", tokens.colors.textSubtle],
    ["iconMuted", tokens.colors.iconMuted],
    ["neutralText", tokens.colors.neutralText],
    ["primary", tokens.colors.primary],
    ["primaryDark", tokens.colors.primaryDark],
    ["primaryDeep", tokens.colors.primaryDeep],
    ["danger", tokens.colors.danger],
    ["dangerDark", tokens.colors.dangerDark],
    ["dangerIcon", tokens.colors.dangerIcon],
    ["warning", tokens.colors.warning],
    ["warningText", tokens.colors.warningText],
    ["success", tokens.colors.success],
    ["successText", tokens.colors.successText],
    ["successDark", tokens.colors.successDark],
    ["blueText", tokens.colors.blueText],
    ["blueStrong", tokens.colors.blueStrong],
    ["orangeDeep", tokens.colors.orangeDeep],
  ])("keeps %s above WCAG AA normal-text contrast on every light layer", (_name, value) => {
    expect(worstContrast(value)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["warningIcon", tokens.colors.warningIcon],
    ["successIcon", tokens.colors.successIcon],
    ["violet", tokens.colors.violet],
    ["primaryLight", tokens.colors.primaryLight],
  ])("keeps the %s glyph above WCAG AA graphics contrast on every light layer", (_name, value) => {
    expect(worstContrast(value)).toBeGreaterThanOrEqual(3);
  });

  it("keeps the welcome hero slogan readable on the lightest gradient stop", () => {
    expect(contrast(tokens.colors.primarySofter, tokens.colors.primary)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast(tokens.colors.surface, tokens.colors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("defines complete typography metrics for reusable UI roles", () => {
    expect(tokens.lineHeight.body).toBeGreaterThan(tokens.typography.body);
    expect(tokens.lineHeight.label).toBeGreaterThan(tokens.typography.label);
    expect(tokens.opacity.disabled).toBeLessThan(tokens.opacity.muted);
  });
});
