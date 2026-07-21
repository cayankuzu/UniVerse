import type { SearchType } from "../domain/types";
import React from "react";
import { tokens } from "../../../shared/theme";
import { t } from "../../../shared/i18n";
import { Calendar, Image as ImageIcon, User, Users } from "lucide-react-native";

export const C = {
  primary: tokens.colors.primary,
  bg: tokens.colors.background,
  surface: tokens.colors.surface,
  text: tokens.colors.text,
  muted: tokens.colors.muted,
  border: tokens.colors.border,
} as const;

export const TABS: Array<{
  key: SearchType;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}> = [
  {
    key: "albums",
    label: t("search.tab.albums"),
    icon: <ImageIcon size={13} color={C.muted} />,
    activeIcon: <ImageIcon size={13} color={tokens.colors.primary} />,
  },
  {
    key: "events",
    label: t("search.tab.events"),
    icon: <Calendar size={13} color={C.muted} />,
    activeIcon: <Calendar size={13} color={tokens.colors.primary} />,
  },
  {
    key: "clubs",
    label: t("search.tab.clubs"),
    icon: <Users size={13} color={C.muted} />,
    activeIcon: <Users size={13} color={tokens.colors.primary} />,
  },
  {
    key: "students",
    label: t("search.tab.students"),
    icon: <User size={13} color={C.muted} />,
    activeIcon: <User size={13} color={tokens.colors.primary} />,
  },
];
