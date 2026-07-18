import { useMemo } from "react";

import type { EventWithMeta } from "../../../data/contracts/content";
import { getEventActionAccess } from "../../../data/policies/visibility";
import type { RelationSnapshot } from "../../../data/policies/visibility.shared";
import { t } from "../../../shared/i18n";
import { normalizeAlbumViewValue } from "../domain/albumUploadState";

interface UseAlbumViewAccessStateParams {
  buildRelationByClub: (usernames: string[]) => Record<string, RelationSnapshot>;
  event: EventWithMeta | null;
  eventQueryError?: unknown;
  hasViewerOwnedPhotos: boolean;
  userData: {
    id?: string;
    username: string;
  };
}

export function useAlbumViewAccessState({
  buildRelationByClub,
  event,
  eventQueryError,
  hasViewerOwnedPhotos,
  userData,
}: UseAlbumViewAccessStateParams) {
  const eventRelationByClub = useMemo(() => {
    const clubUsername = normalizeAlbumViewValue(event?.clubUsername || "");
    return clubUsername ? buildRelationByClub([clubUsername]) : {};
  }, [buildRelationByClub, event?.clubUsername]);
  const eventAccess = useMemo(() => {
    if (!event) return null;
    const clubUsername = normalizeAlbumViewValue(event.clubUsername || "");
    return getEventActionAccess(userData.username, event, eventRelationByClub[clubUsername]);
  }, [event, eventRelationByClub, userData.username]);
  const isEventOwnerClub =
    String(userData.id || "").trim() !== "" &&
    String(userData.id || "").trim() === String(event?.clubUserId || "").trim();
  const hasUploadAccess =
    typeof eventAccess?.canUploadAlbum === "boolean"
      ? eventAccess.canUploadAlbum
      : isEventOwnerClub || Boolean(event?.joined);
  const eventErrorMessage = String((eventQueryError as { message?: string } | null)?.message || "");
  const accessMessage =
    eventAccess && !eventAccess.canOpenAlbum && !hasViewerOwnedPhotos
      ? eventAccess.albumReason || eventAccess.reason || "Bu album sadece takipcilere acik."
      : eventErrorMessage.includes("not visible")
        ? "Bu album sadece takipcilere acik."
        : null;
  const uploadMessage = !event
    ? `${t("events.detail.title")} bilgisi yukleniyor. Lutfen tekrar deneyin.`
    : hasUploadAccess
      ? ""
      : eventAccess?.uploadReason ||
        eventAccess?.albumReason ||
        eventAccess?.reason ||
        t("events.album.warning.permission");
  const canUpload = Boolean(event && hasUploadAccess);
  const subtitle = event?.title || t("events.album.subtitle.fallback");

  return {
    accessMessage,
    canUpload,
    eventAccess,
    subtitle,
    uploadMessage,
  };
}
