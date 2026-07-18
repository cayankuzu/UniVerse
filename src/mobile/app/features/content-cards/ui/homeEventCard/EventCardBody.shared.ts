import {
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Lock,
  Package,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react-native";

import type { EventWithMeta } from "../../data";
import { resolveEventAccessInfo } from "../../application/eventPresentation";
import { tokens } from "../../../../shared/theme";

export interface AccessChip {
  backgroundColor: string;
  color: string;
  icon: LucideIcon;
  label: string;
}

export interface EventMetaChip {
  kind: "category" | "type";
  label: string;
}

export interface SlideItem {
  backgroundColor: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
  sub: string;
  textColor: string;
}

export function resolveEventAccessChip(event: EventWithMeta): AccessChip {
  const access = resolveEventAccessInfo(event);

  if (access.kind === "public") {
    return {
      backgroundColor: tokens.colors.successSoft,
      color: tokens.colors.success,
      icon: Globe,
      label: access.label,
    };
  }

  if (access.kind === "members_only") {
    return {
      backgroundColor: tokens.colors.dangerSoft,
      color: tokens.colors.dangerDark,
      icon: Lock,
      label: access.label,
    };
  }

  return {
    backgroundColor: tokens.colors.accent,
    color: tokens.colors.primaryDark,
    icon: Users,
    label: access.label,
  };
}

export function buildEventInfoSlides(
  event: EventWithMeta,
  dateLabel: string,
  timeLabel: string,
): SlideItem[] {
  const isFree = String(event.fee || "")
    .toLowerCase()
    .includes("Ücretsiz");
  const slides: SlideItem[] = [
    {
      backgroundColor: isFree ? tokens.colors.successSoft : tokens.colors.warningSoft,
      icon: DollarSign,
      iconColor: isFree ? tokens.colors.successIcon : tokens.colors.warningIcon,
      label: event.fee || "Ücretsiz",
      sub: "Ücret",
      textColor: isFree ? tokens.colors.success : tokens.colors.orangeText,
    },
    {
      backgroundColor: tokens.colors.accent,
      icon: Calendar,
      iconColor: tokens.colors.primary,
      label: dateLabel,
      sub: event.endDate && event.endDate !== event.startDate ? `-> ${event.endDate}` : "Başlangıç",
      textColor: tokens.colors.primaryDark,
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
      textColor: tokens.colors.warning,
    });
  }

  return slides;
}

export function buildEventMetaChips(event: EventWithMeta): EventMetaChip[] {
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

export function resolveMetaChipIcon(chip: EventMetaChip) {
  return chip.kind === "type" ? BarChart3 : Tag;
}
