import {
  buildHiddenLikeUser,
  mapFollowUser,
  normalizeSearchUserResult,
} from "../../normalizers/searchUsers";
import type { SearchUserResult } from "../../contracts/api";

async function fetchEventPeopleFromApi(path: string): Promise<SearchUserResult[]> {
  void path;
  return [];
}

export function fetchEventLikesFromApi(id: string) {
  return fetchEventPeopleFromApi(`/events/${id}/likes`);
}

export function fetchEventAttendeesFromApi(id: string) {
  return fetchEventPeopleFromApi(`/events/${id}/attendees`);
}

export { buildHiddenLikeUser, mapFollowUser, normalizeSearchUserResult };
