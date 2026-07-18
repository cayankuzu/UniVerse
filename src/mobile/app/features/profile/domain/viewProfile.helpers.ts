import { tokens } from "../../../shared/theme";

export const PROFILE_COLORS = {
  bg: tokens.colors.background,
  surface: tokens.colors.surface,
  text: tokens.colors.foreground,
  muted: tokens.colors.muted,
  border: tokens.colors.border,
  danger: tokens.colors.danger,
} as const;

export function normalizeProfileValue(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getFollowLabel(
  followStatus: "none" | "requested" | "following",
  isPrivate?: boolean,
) {
  if (followStatus === "following") return "Takiptesin";
  if (followStatus === "requested") return "İstek Gönderildi (İptal Et)";
  if (isPrivate) return "Takip İsteği Gönder";
  return "Takip Et";
}

export function getFollowVariant(followStatus: "none" | "requested" | "following") {
  if (followStatus === "following") return "secondary" as const;
  if (followStatus === "requested") return "ghost" as const;
  return "primary" as const;
}
