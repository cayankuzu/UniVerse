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
import { tokens } from "../../../shared/theme";

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
      backgroundColor: tokens.colors.successSoft,
      color: tokens.colors.successText,
      icon: Globe,
      label: access.label,
    };
  }

  if (access.kind === "members_only") {
    return {
      backgroundColor: tokens.colors.dangerSoft,
      color: tokens.colors.dangerIcon,
      icon: Lock,
      label: access.label,
    };
  }

  return {
    backgroundColor: tokens.colors.primarySofter,
    color: tokens.colors.blueText,
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
      backgroundColor: isFree ? tokens.colors.successSoft : tokens.colors.warningSoft,
      icon: DollarSign,
      iconColor: isFree ? tokens.colors.successIcon : tokens.colors.warningIcon,
      label: event.fee || "Ücretsiz",
      sub: "Ücret",
      textColor: isFree ? tokens.colors.successText : tokens.colors.warning,
    },
    {
      backgroundColor: tokens.colors.primarySofter,
      icon: Calendar,
      iconColor: tokens.colors.primary,
      label: dateLabel,
      sub: event.endDate && event.endDate !== event.startDate ? `-> ${event.endDate}` : "Başlangıç",
      textColor: tokens.colors.blueText,
    },
    {
      backgroundColor: tokens.colors.indigoSoft,
      icon: Clock,
      iconColor: tokens.colors.indigo,
      label: timeLabel,
      sub: "Saat",
      textColor: tokens.colors.indigoDark,
    },
  ];

  if (event.level) {
    slides.push({
      backgroundColor: tokens.colors.cyanSoft,
      icon: BarChart3,
      iconColor: tokens.colors.cyan,
      label: event.level,
      sub: "Seviye",
      textColor: tokens.colors.cyanDark,
    });
  }

  if (event.materials) {
    slides.push({
      backgroundColor: tokens.colors.warningSurface,
      icon: Package,
      iconColor: tokens.colors.orangeDark,
      label: event.materials,
      sub: "Malzemeler",
      textColor: tokens.colors.orangeStrong,
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
