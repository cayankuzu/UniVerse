import { supabase } from "../../../platform/supabase";
import type { SearchUserResult } from "../../contracts/api";
import {
  filterBlockedSearchUsers,
  filterBlockedUserIds,
  loadViewerBlockedVisibility,
} from "../../social/blockedVisibility";
import { buildHiddenLikeUser, mapFollowUser } from "./events.models";

async function fetchEventPeopleList(params: {
  eventId: string;
  fallback: () => Promise<SearchUserResult[]>;
  relationTable: "event_attendees" | "event_likes";
}) {
  const [fromApi, blockedVisibility] = await Promise.all([
    params.fallback(),
    loadViewerBlockedVisibility(),
  ]);
  const filteredFallback = filterBlockedSearchUsers(fromApi, blockedVisibility);
  const { data: rows, error } = await supabase
    .from(params.relationTable)
    .select("user_id")
    .eq("event_id", params.eventId);

  if (error || !Array.isArray(rows)) {
    return filteredFallback;
  }

  const userIds = filterBlockedUserIds(
    rows.map((item) => String(item.user_id || "").trim()),
    blockedVisibility,
  );
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "user_id,username,name,club_name,profile_image_path,cover_image_path,university,is_private,department,grade_year,categories,description",
    )
    .in("user_id", userIds);

  const mappedProfiles = filterBlockedSearchUsers(
    ((profiles || []) as unknown[]).map((profile) =>
      mapFollowUser(profile as Record<string, unknown>),
    ) as SearchUserResult[],
    blockedVisibility,
  );
  if (mappedProfiles.length >= userIds.length) return mappedProfiles;

  const visibleIds = new Set(mappedProfiles.map((profile) => profile.id));
  const hiddenUsers = userIds
    .filter((userId) => !visibleIds.has(userId))
    .map((userId, index) => buildHiddenLikeUser(userId, index));
  return [...mappedProfiles, ...hiddenUsers];
}

export function getEventLikesList(eventId: string, fallback: () => Promise<SearchUserResult[]>) {
  return fetchEventPeopleList({
    eventId,
    fallback,
    relationTable: "event_likes",
  });
}

export function getEventAttendeesList(
  eventId: string,
  fallback: () => Promise<SearchUserResult[]>,
) {
  return fetchEventPeopleList({
    eventId,
    fallback,
    relationTable: "event_attendees",
  });
}
