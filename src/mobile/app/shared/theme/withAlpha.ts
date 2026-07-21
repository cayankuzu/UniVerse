function normalizeHexChannel(value: string) {
  return Number.parseInt(value, 16);
}

/** Builds a platform-safe rgba value from a six-digit theme color. */
export function withAlpha(hex: string, alpha: number) {
  const normalized = String(hex || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return hex;
  }

  const red = normalizeHexChannel(normalized.slice(0, 2));
  const green = normalizeHexChannel(normalized.slice(2, 4));
  const blue = normalizeHexChannel(normalized.slice(4, 6));
  const boundedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${red},${green},${blue},${boundedAlpha})`;
}
