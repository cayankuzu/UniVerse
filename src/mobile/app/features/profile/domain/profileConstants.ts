import { tokens } from "../../../shared/theme";

export type ProfileTab = "album" | "events";
export type AlbumOwnerFilter = "all" | "club" | "students";
export const PROFILE_TAB_ORDER: readonly ProfileTab[] = ["album", "events"];

export interface ProfileTabItem {
  key: ProfileTab;
  label: string;
  count: number;
}

export const PROFILE_COLORS = {
  primary: tokens.colors.primary,
  bg: tokens.colors.background,
  surface: tokens.colors.surface,
  text: tokens.colors.foreground,
  muted: tokens.colors.muted,
  border: tokens.colors.border,
  danger: tokens.colors.danger,
} as const;
