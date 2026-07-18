import {
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Lock,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import type { EventWithMeta } from "../data";
import { resolveEventAccessInfo } from "./eventPresentation";

export interface DetailAccessChip {
  backgroundColor: string;
  color: string;
  icon: LucideIcon;
  label: string;
}

export interface DetailMetaChip {
  kind: "category" | "type";
  label: string;
}

export interface DetailSlideItem {
  backgroundColor: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
  sub: string;
  textColor: string;
}

type EventAccessWarningReason = {
  albumReason?: string | null;
  reason?: string | null;
};

export const TEMP_EVENT_WARNING = "Etkinlik henüz kaydediliyor. Birazdan tekrar deneyin.";

export function getAlbumWarningMessage(reason: EventAccessWarningReason) {
  return reason.albumReason || reason.reason || "Bu albüm sadece yetkili kullanıcılara açık.";
}

export function getLocationWarningMessage(reason: EventAccessWarningReason) {
  return (
    reason.albumReason || reason.reason || "Konum bilgisi bu etkinlik için sadece takipçilere açık."
  );
}

export function resolveEventDetailAccessChip(event: EventWithMeta): DetailAccessChip {
  const access = resolveEventAccessInfo(event);

  if (access.kind === "public") {
    return {
      backgroundColor: "#ecfdf5",
      color: "#047857",
      icon: Globe,
      label: access.label,
    };
  }

  if (access.kind === "members_only") {
    return {
      backgroundColor: "#fef2f2",
      color: "#dc2626",
      icon: Lock,
      label: access.label,
    };
  }

  return {
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    icon: Users,
    label: access.label,
  };
}

export function buildEventDetailInfoSlides(
  event: EventWithMeta,
  dateLabel: string,
  timeLabel: string,
): DetailSlideItem[] {
  const isFree = String(event.fee || "")
    .toLowerCase()
    .includes("Ücretsiz");
  const slides: DetailSlideItem[] = [
    {
      backgroundColor: isFree ? "#ecfdf5" : "#fffbeb",
      icon: DollarSign,
      iconColor: isFree ? "#059669" : "#d97706",
      label: event.fee || "Ücretsiz",
      sub: "Ücret",
      textColor: isFree ? "#047857" : "#b45309",
    },
    {
      backgroundColor: "#eff6ff",
      icon: Calendar,
      iconColor: "#2563eb",
      label: dateLabel,
      sub: event.endDate && event.endDate !== event.startDate ? `-> ${event.endDate}` : "Başlangıç",
      textColor: "#1d4ed8",
    },
    {
      backgroundColor: "#eef2ff",
      icon: Clock,
      iconColor: "#4f46e5",
      label: timeLabel,
      sub: "Saat",
      textColor: "#4338ca",
    },
  ];

  if (event.level) {
    slides.push({
      backgroundColor: "#ecfeff",
      icon: BarChart3,
      iconColor: "#0891b2",
      label: event.level,
      sub: "Seviye",
      textColor: "#0e7490",
    });
  }

  if (event.materials) {
    slides.push({
      backgroundColor: "#fff7ed",
      icon: Package,
      iconColor: "#ea580c",
      label: event.materials,
      sub: "Malzemeler",
      textColor: "#c2410c",
    });
  }

  return slides;
}

export function buildEventDetailMetaChips(event: EventWithMeta): DetailMetaChip[] {
  const typeChip = event.type ? [{ kind: "type" as const, label: event.type }] : [];
  const categoryChips =
    (event.categories || []).length > 0
      ? (event.categories || []).map((category) => ({
          kind: "category" as const,
          label: category,
        }))
      : [{ kind: "category" as const, label: event.category || "Kategori" }];
  return [...typeChip, ...categoryChips].slice(0, 10);
}

export function formatEventDetailSummary(event: EventWithMeta) {
  const dateLabel = String(event.startDate || event.date || "").trim();
  const timeLabel = String(
    event.startTime && event.endTime
      ? `${event.startTime} - ${event.endTime}`
      : event.startTime || "",
  ).trim();
  const location = String(event.location || event.address || "").trim();
  return [dateLabel, timeLabel, location].filter(Boolean);
}
