import { tokens } from "../../../../shared/theme";

export const DISCOVERY_GRID_CARD_COLORS = {
  surface: tokens.colors.surface,
  text: tokens.colors.foreground,
  muted: tokens.colors.muted,
  border: tokens.colors.border,
} as const;

export function resolveAlbumUniversity(item: {
  university?: string | null;
  userUniversity?: string | null;
}) {
  const value = String(item.userUniversity || item.university || "").trim();
  return value || "Üniversite bilgisi yok";
}
