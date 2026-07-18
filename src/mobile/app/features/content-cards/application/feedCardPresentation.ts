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
import type { AlbumPhotoWithMeta, EventWithMeta } from "../../../data/contracts/content";
import type { AlbumVisibilityLabel } from "../../../data/contracts/entities";
import {
  getAlbumSurfaceLabel,
  resolveAlbumSurfaceVisibility,
} from "../../../data/normalizers/albums";
import { resolveEventAccessInfo, type EventAccessKind } from "./eventPresentation";

export type PreparedEventAccessChip = {
  kind: EventAccessKind;
  label: string;
};

export type PreparedEventMetaChip = {
  kind: "category" | "type";
  label: string;
};

export type PreparedEventSlideTone = "success" | "warning" | "blue" | "indigo" | "cyan" | "orange";

export type PreparedEventInfoSlide = {
  kind: "fee" | "date" | "time" | "level" | "materials";
  label: string;
  sub: string;
  tone: PreparedEventSlideTone;
};

export type PreparedAlbumVisibility = AlbumVisibilityLabel;

export type PreparedEventAccessChipDisplay = {
  backgroundColor: string;
  color: string;
  icon: LucideIcon;
  label: string;
};

export type PreparedEventInfoSlideDisplay = {
  backgroundColor: string;
  icon: LucideIcon;
  iconColor: string;
  label: string;
  sub: string;
  textColor: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim();
}

export function resolveAvatarInitials(name?: string | null) {
  const normalized = normalizeText(name);
  if (!normalized) return "?";
  return normalized
    .split(/\s+/)
    .map((chunk) => chunk[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatEventHeaderDate(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatEventHeaderTime(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAlbumCreatedAtLabel(value?: string | null) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function resolveAlbumUniversityLabel(photo: AlbumPhotoWithMeta) {
  const university = normalizeText(
    photo.userUniversity || (photo as AlbumPhotoWithMeta & { university?: string }).university,
  );
  return university || "Üniversite bilgisi yok";
}

export function buildPreparedEventAccessChip(event: EventWithMeta): PreparedEventAccessChip {
  const access = resolveEventAccessInfo(event);
  return {
    kind: access.kind,
    label: access.label,
  };
}

export function resolvePreparedEventAccessChipDisplay(
  chip: PreparedEventAccessChip,
): PreparedEventAccessChipDisplay {
  if (chip.kind === "public") {
    return {
      backgroundColor: "#ecfdf5",
      color: "#047857",
      icon: Globe,
      label: chip.label,
    };
  }

  if (chip.kind === "members_only") {
    return {
      backgroundColor: "#fef2f2",
      color: "#dc2626",
      icon: Lock,
      label: chip.label,
    };
  }

  return {
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    icon: Users,
    label: chip.label,
  };
}

export function buildPreparedEventMetaChips(event: EventWithMeta): PreparedEventMetaChip[] {
  const chips: PreparedEventMetaChip[] = [];
  const typeLabel = normalizeText(event.type);
  if (typeLabel) {
    chips.push({ kind: "type", label: typeLabel });
  }
  const categoryValues =
    Array.isArray(event.categories) && event.categories.length > 0
      ? event.categories
      : [event.category || "Kategori"];
  categoryValues.forEach((category) => {
    const label = normalizeText(category);
    if (!label) return;
    chips.push({ kind: "category", label });
  });
  return chips.slice(0, 10);
}

export function buildPreparedEventInfoSlides(
  event: EventWithMeta,
  labels?: {
    dateLabel?: string;
    timeLabel?: string;
  },
): PreparedEventInfoSlide[] {
  const dateLabel = normalizeText(labels?.dateLabel || event.startDate || event.date) || "-";
  const timeLabel =
    normalizeText(labels?.timeLabel) ||
    (event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : "-");
  const isFree = normalizeText(event.fee).toLowerCase().includes("Ücretsiz");
  const slides: PreparedEventInfoSlide[] = [
    {
      kind: "fee",
      label: normalizeText(event.fee) || "Ücretsiz",
      sub: "Ücret",
      tone: isFree ? "success" : "warning",
    },
    {
      kind: "date",
      label: dateLabel,
      sub: event.endDate && event.endDate !== event.startDate ? `-> ${event.endDate}` : "Başlangıç",
      tone: "blue",
    },
    {
      kind: "time",
      label: timeLabel,
      sub: "Saat",
      tone: "indigo",
    },
  ];

  const levelLabel = normalizeText(event.level);
  if (levelLabel) {
    slides.push({
      kind: "level",
      label: levelLabel,
      sub: "Seviye",
      tone: "cyan",
    });
  }

  const materialsLabel = normalizeText(event.materials);
  if (materialsLabel) {
    slides.push({
      kind: "materials",
      label: materialsLabel,
      sub: "Malzemeler",
      tone: "orange",
    });
  }

  return slides;
}

export function resolvePreparedEventInfoSlideDisplay(
  slide: PreparedEventInfoSlide,
): PreparedEventInfoSlideDisplay {
  switch (slide.kind) {
    case "fee":
      return {
        backgroundColor: slide.tone === "success" ? "#ecfdf5" : "#fffbeb",
        icon: DollarSign,
        iconColor: slide.tone === "success" ? "#059669" : "#d97706",
        label: slide.label,
        sub: slide.sub,
        textColor: slide.tone === "success" ? "#047857" : "#b45309",
      };
    case "date":
      return {
        backgroundColor: "#eff6ff",
        icon: Calendar,
        iconColor: "#2563eb",
        label: slide.label,
        sub: slide.sub,
        textColor: "#1d4ed8",
      };
    case "time":
      return {
        backgroundColor: "#eef2ff",
        icon: Clock,
        iconColor: "#4f46e5",
        label: slide.label,
        sub: slide.sub,
        textColor: "#4338ca",
      };
    case "level":
      return {
        backgroundColor: "#ecfeff",
        icon: BarChart3,
        iconColor: "#0891b2",
        label: slide.label,
        sub: slide.sub,
        textColor: "#0e7490",
      };
    case "materials":
      return {
        backgroundColor: "#fff7ed",
        icon: Package,
        iconColor: "#ea580c",
        label: slide.label,
        sub: slide.sub,
        textColor: "#c2410c",
      };
  }
}

export function buildPreparedAlbumVisibility(
  photo: AlbumPhotoWithMeta,
  context: "feed" | "search" | "profile" | "event_album" = "feed",
): PreparedAlbumVisibility {
  if (context === "event_album") {
    return getAlbumSurfaceLabel(photo, context);
  }
  return resolveAlbumSurfaceVisibility(photo).label;
}
