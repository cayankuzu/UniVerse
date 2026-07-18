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

export type FilterCategory = "all" | "social" | "like" | "comment" | "club";

export const FILTERS: Array<{
  key: FilterCategory;
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  activeBg: string;
}> = [
  { key: "all", label: "Tumu", icon: Bell, color: "#64748b", activeBg: "#e2e8f0" },
  { key: "social", label: "Sosyal", icon: Users, color: "#7c3aed", activeBg: "#ede9fe" },
  { key: "like", label: "Beğeni", icon: Heart, color: "#ef4444", activeBg: "#fee2e2" },
  { key: "comment", label: "Yorumlar", icon: MessageSquare, color: "#2563eb", activeBg: "#dbeafe" },
  { key: "club", label: "Kulüp", icon: Calendar, color: "#d97706", activeBg: "#fef3c7" },
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
  if (type === "comment") return "#dbeafe";
  if (type === "like") return "#fee2e2";
  if (type === "follow" || type === "follow_request" || type === "follow_accepted")
    return "#ede9fe";
  if (
    type === "event" ||
    type === "join" ||
    type === "join_request" ||
    type === "join_accepted" ||
    type === "join_rejected" ||
    type === "system"
  ) {
    return "#fef3c7";
  }
  return "#e2e8f0";
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
