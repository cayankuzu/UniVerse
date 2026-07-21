import type { ComponentType } from "react";
import {
  Bell,
  Calendar,
  Heart,
  MessageSquare,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react-native";
import { tokens } from "../../../shared/theme";

export type FilterCategory = "all" | "social" | "like" | "comment" | "club";

export const FILTERS: Array<{
  key: FilterCategory;
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  activeBg: string;
}> = [
  {
    key: "all",
    label: "Tümü",
    icon: Bell,
    color: tokens.colors.textSecondary,
    activeBg: tokens.colors.primarySofter,
  },
  {
    key: "social",
    label: "Sosyal",
    icon: Users,
    color: tokens.colors.primary,
    activeBg: tokens.colors.primarySofter,
  },
  {
    key: "like",
    label: "Beğeni",
    icon: Heart,
    color: tokens.colors.danger,
    activeBg: tokens.colors.primarySofter,
  },
  {
    key: "comment",
    label: "Yorumlar",
    icon: MessageSquare,
    color: tokens.colors.primary,
    activeBg: tokens.colors.primarySofter,
  },
  {
    key: "club",
    label: "Kulüp",
    icon: Calendar,
    color: tokens.colors.textSecondary,
    activeBg: tokens.colors.primarySofter,
  },
];

export function mapNotificationIcon(type: string) {
  if (type === "follow_request") return UserPlus;
  if (type === "follow") return Users;
  if (type === "follow_accepted") return UserCheck;
  if (type === "like") return Heart;
  if (type === "comment") return MessageSquare;
  if (
    type === "event" ||
    type === "join" ||
    type === "join_request" ||
    type === "join_accepted" ||
    type === "join_rejected" ||
    type === "system"
  ) {
    return Calendar;
  }
  return Bell;
}

export function getNotificationIconBg(type: string) {
  if (type === "comment") return tokens.colors.primarySoft;
  if (type === "like") return tokens.colors.dangerSurface;
  if (type === "follow" || type === "follow_request" || type === "follow_accepted")
    return tokens.colors.primarySofter;
  if (
    type === "event" ||
    type === "join" ||
    type === "join_request" ||
    type === "join_accepted" ||
    type === "join_rejected" ||
    type === "system"
  ) {
    return tokens.colors.surfaceVariant;
  }
  return tokens.colors.surfaceVariant;
}

export function toFilterCategory(type: string): FilterCategory {
  if (type === "follow_request" || type === "follow" || type === "follow_accepted") {
    return "social";
  }
  if (type === "like") return "like";
  if (type === "comment") return "comment";
  if (
    type === "event" ||
    type === "join" ||
    type === "join_request" ||
    type === "join_accepted" ||
    type === "join_rejected" ||
    type === "system"
  ) {
    return "club";
  }
  return "all";
}
