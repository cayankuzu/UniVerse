import type { AlbumPhotoWithMeta, EventWithMeta } from "../contracts/content";

export function normalizeEventAccessLabel(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0131\u0130]/g, "i")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[\u00e7\u00c7]/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveVisibilityFromAccess(accessLabel: string) {
  const normalized = normalizeEventAccessLabel(accessLabel);
  return normalized.includes("uye") || normalized.includes("member") ? "members_only" : "public";
}

export type EventAccessKind = "public" | "members_only" | "general";
export type EventVisibilityKind = "public" | "members_only" | "followers_only";

export interface EventAccessInfo {
  kind: EventAccessKind;
  label: string;
}

export interface EventVisibilityInfo {
  kind: EventVisibilityKind;
  label: string;
}

function isMembersOnlyText(value: string) {
  const normalized = normalizeEventAccessLabel(value);
  return (
    normalized.includes("sadece uyeler") ||
    normalized.includes("uyelere Özel") ||
    normalized.includes("uye") ||
    normalized.includes("uyeler") ||
    normalized.includes("member")
  );
}

export function resolveEventAccess(
  event: Pick<EventWithMeta, "access" | "effectiveVisibility" | "visibility">,
): EventAccessInfo {
  const resolvedVisibility = String(event.effectiveVisibility || event.visibility || "")
    .trim()
    .toLowerCase();
  const accessRaw = String(event.access || "").trim();

  if (isMembersOnlyText(accessRaw) || resolvedVisibility === "members_only") {
    return { kind: "members_only", label: accessRaw || "Takipçilere Açık" };
  }

  if (resolvedVisibility === "followers_only") {
    return { kind: "general", label: accessRaw || "Takipçilere Açık" };
  }

  if (normalizeEventAccessLabel(accessRaw).includes("herkese")) {
    return { kind: "public", label: accessRaw || "Herkese Açık" };
  }

  return { kind: "general", label: accessRaw || "Genel Erişim" };
}

export function resolveEventVisibility(
  event: Pick<EventWithMeta, "effectiveVisibility" | "visibility">,
): EventVisibilityInfo {
  const resolved = event.effectiveVisibility || event.visibility;

  if (resolved === "members_only") {
    return { kind: "members_only", label: "Takipçilere Açık" };
  }

  if (resolved === "followers_only") {
    return { kind: "followers_only", label: "Takipçilere Açık" };
  }

  return { kind: "public", label: "Herkese Görünür" };
}

export function resolveAlbumAccess(
  album: Pick<AlbumPhotoWithMeta, "eventVisibility" | "effectiveVisibility"> & {
    access?: string;
    eventAccess?: string;
    event_access?: string;
  },
): EventAccessInfo {
  const accessRaw = String(album.access || album.eventAccess || album.event_access || "").trim();
  if (
    album.effectiveVisibility === "members_only" ||
    album.eventVisibility === "members_only" ||
    isMembersOnlyText(accessRaw)
  ) {
    return { kind: "members_only", label: accessRaw || "Takipçilere Açık" };
  }
  return { kind: "public", label: accessRaw || "Herkese Açık" };
}

export function resolveAlbumVisibility(
  album: Pick<AlbumPhotoWithMeta, "effectiveVisibility" | "eventVisibility">,
): EventVisibilityInfo {
  if (album.eventVisibility === "members_only" || album.effectiveVisibility === "members_only") {
    return { kind: "members_only", label: "Takipçilere Açık" };
  }
  return { kind: "public", label: "Herkese Görünür" };
}
