import { useMemo } from "react";
import type { EventWithMeta } from "../data";

export function resolvePendingEventStatus(
  eventId: string,
  uploadStatus?: EventWithMeta["uploadStatus"],
) {
  const normalizedStatus = String(uploadStatus || "").trim();
  if (normalizedStatus) {
    return normalizedStatus as EventWithMeta["uploadStatus"];
  }
  return String(eventId || "").startsWith("temp-event:") ? "pending" : undefined;
}

interface UseEventPendingCardActionsParams {
  eventId: string;
  uploadStatus?: EventWithMeta["uploadStatus"];
}

export function useEventPendingCardActions(params: UseEventPendingCardActionsParams) {
  const { eventId, uploadStatus } = params;
  const pendingStatus = useMemo(
    () => resolvePendingEventStatus(eventId, uploadStatus),
    [eventId, uploadStatus],
  );

  return {
    pendingStatus,
  };
}
