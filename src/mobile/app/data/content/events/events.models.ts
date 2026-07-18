import type { EventWithMeta } from "../../contracts/content";
import {
  mapEventProjectionRow,
  normalizeProjectionEvent,
  type EventProjectionRpcRow,
} from "../../normalizers/events";
import { supabase } from "../../../platform/supabase";
export type { EventWithMeta } from "../../contracts/content";
export { normalizeProjectionEvent };

export interface CreateEventPayload {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  type: string;
  access: string;
  fee: string;
  capacity: number;
  targetAudience: string;
  level: string;
  materials: string;
  category: string;
  categories: string[];
  image: string;
  clientMutationId?: string;
}

export type EventRpcRow = EventProjectionRpcRow;

export interface EventTableRow {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  cover_image_path: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string | null;
  address: string | null;
  event_type: string | null;
  category: string | null;
  categories: string[] | null;
  fee_label: string | null;
  access_label: string | null;
  capacity: number | null;
  target_audience: string | null;
  level: string | null;
  materials: string | null;
  visibility: "public" | "members_only";
  created_at: string;
}

export const mapEventRow = mapEventProjectionRow;

function isMembersOnlyEvent(event: Pick<EventWithMeta, "visibility" | "effectiveVisibility">) {
  return event.visibility === "members_only" || event.effectiveVisibility === "members_only";
}

function isRestrictedEventCard(
  event: Pick<EventWithMeta, "visibility" | "effectiveVisibility" | "clubIsPrivate">,
) {
  return isMembersOnlyEvent(event) || event.effectiveVisibility === "followers_only";
}

export function mergeSupplementalRestrictedEvents(
  primary: EventWithMeta[],
  fallback: EventWithMeta[],
): EventWithMeta[] {
  const merged = new Map<string, EventWithMeta>();

  primary.forEach((item) => {
    if (!item?.id) return;
    merged.set(item.id, item);
  });

  fallback.forEach((item) => {
    if (!item?.id || merged.has(item.id) || !isRestrictedEventCard(item)) return;
    merged.set(item.id, item);
  });

  return Array.from(merged.values());
}

export function mergeEventCollections(...collections: EventWithMeta[][]): EventWithMeta[] {
  const merged = new Map<string, EventWithMeta>();

  collections.forEach((items) => {
    items.forEach((item) => {
      if (!item?.id || merged.has(item.id)) return;
      merged.set(item.id, item);
    });
  });

  return Array.from(merged.values());
}

export async function fetchEventsFromRpc(
  rpcName: string,
  params: Record<string, unknown>,
): Promise<EventWithMeta[] | null> {
  const { data, error } = await supabase.rpc(rpcName, params);
  if (error || !Array.isArray(data)) return null;
  return data.map((row) => mapEventProjectionRow(row as EventRpcRow));
}

export {
  buildHiddenLikeUser,
  fetchEventAttendeesFromApi,
  fetchEventLikesFromApi,
  mapFollowUser,
  normalizeSearchUserResult,
} from "./events.users";
export { fetchEventCommentsFromApi, normalizeCommentItem } from "./events.commentsApi";
