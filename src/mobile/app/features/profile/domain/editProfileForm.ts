import { tokens } from "../../../shared/theme";

export const EDIT_PROFILE_TOTAL_STEPS = 4;
export const EDIT_PROFILE_STEP_LABELS = [
  "Bilgiler",
  "Üniversite",
  "Profil",
  "Kategoriler",
] as const;
export const EDIT_PROFILE_COLORS = {
  bg: tokens.colors.background,
  text: tokens.colors.foreground,
  muted: tokens.colors.muted,
  border: tokens.colors.border,
  primary: tokens.colors.primary,
  danger: tokens.colors.danger,
} as const;

export type EditProfileFormState = {
  username: string;
  name: string;
  clubName: string;
  email: string;
  university: string;
  department: string;
  gradeYear: string;
  bio: string;
  description: string;
};

export function sanitizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}
