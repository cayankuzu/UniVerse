import type { SearchUserResult } from "../../../../data/contracts/api";
import { AlbumAPI, EventAPI } from "../../../../data/content";
import type { EventWithMeta, AlbumPhotoWithMeta } from "../../../../data/contracts/content";
import { resolveProfilePrivacy } from "../../../../data/policies/profilePrivacy";
import {
  createEmptyBlockedVisibilitySnapshot,
  filterBlockedAlbums,
  filterBlockedEvents,
  filterBlockedSearchUsers,
  loadViewerBlockedVisibilityOrEmpty,
} from "../../../../data/social/blockedVisibility";
import { supabase } from "../../../../platform/supabase";
import { toDisplayName } from "../../../../data/profile/profileDisplay";

const SEARCH_QUERY_MAX_LENGTH = 80;
const SEARCH_RESULT_LIMIT_MAX = 50;

function clampSearchQuery(value: string) {
  return value.trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
}

function clampSearchLimit(limit?: number, fallback = SEARCH_RESULT_LIMIT_MAX) {
  const parsed = typeof limit === "number" ? limit : fallback;
  return Math.max(1, Math.min(parsed, SEARCH_RESULT_LIMIT_MAX));
}

function filterEventsLocally(
  list: EventWithMeta[],
  query: string,
  university?: string,
  category?: string,
) {
  const normalized = query.trim().toLowerCase();
  return list.filter((item) => {
    const textMatch =
      !normalized ||
      item.title.toLowerCase().includes(normalized) ||
      item.club.toLowerCase().includes(normalized) ||
      item.description.toLowerCase().includes(normalized) ||
      item.location.toLowerCase().includes(normalized);
    const universityMatch = !university || item.university === university;
    const categoryMatch = !category || item.category === category;
    return textMatch && universityMatch && categoryMatch;
  });
}

function filterAlbumsLocally(list: AlbumPhotoWithMeta[], query: string) {
  const normalized = query.trim().toLowerCase();
  return list.filter((item) => {
    if (!normalized) return true;
    return [
      item.title,
      item.caption,
      item.eventTitle,
      item.name,
      item.username,
      item.clubName,
      item.clubUsername,
    ]
      .map((value) => String(value || "").toLowerCase())
      .some((value) => value.includes(normalized));
  });
}

async function fallbackSearchProfiles(
  q: string,
  type: "clubs" | "students",
  university?: string,
  category?: string,
  limit = SEARCH_RESULT_LIMIT_MAX,
  blockedVisibility = createEmptyBlockedVisibilitySnapshot(),
): Promise<SearchUserResult[]> {
  let query = supabase
    .from("profiles")
    .select(
      "user_id,username,name,club_name,profile_image_path,cover_image_path,university,is_private,department,grade_year,categories,description,bio,created_at",
    )
    .eq("account_type", type === "clubs" ? "club" : "student");

  const normalized = clampSearchQuery(q);
  if (normalized) {
    const escaped = normalized.replace(/,/g, " ");
    if (type === "clubs") {
      query = query.or(`username.ilike.%${escaped}%,club_name.ilike.%${escaped}%`);
    } else {
      query = query.or(`username.ilike.%${escaped}%,name.ilike.%${escaped}%`);
    }
  }

  if (university) {
    query = query.eq("university", university);
  }

  if (category && type === "clubs") {
    query = query.contains("categories", [category]);
  }

  const safeLimit = clampSearchLimit(limit);
  const { data, error } = await query.limit(safeLimit);
  if (error || !data) {
    throw new Error(error?.message || "Arama verisi alınamadı");
  }

  return filterBlockedSearchUsers(
    data.map((profile) => ({
      id: profile.user_id,
      username: profile.username,
      name: toDisplayName(profile),
      image: profile.profile_image_path || "",
      coverImage: profile.cover_image_path || "",
      university: profile.university,
      isPrivate: resolveProfilePrivacy(type === "clubs" ? "club" : "student", profile.is_private),
      createdAt: profile.created_at || "",
      department: profile.department || undefined,
      year: profile.grade_year || undefined,
      category: Array.isArray(profile.categories) ? profile.categories[0] : undefined,
      categories: Array.isArray(profile.categories) ? profile.categories : [],
      description: profile.description || profile.bio || undefined,
      bio: profile.bio || profile.description || undefined,
    })) as SearchUserResult[],
    blockedVisibility,
  );
}

export const SearchAPI = {
  search: async (
    q: string,
    type: "albums" | "events" | "clubs" | "students",
    university?: string,
    category?: string,
    limit?: number,
  ): Promise<EventWithMeta[] | AlbumPhotoWithMeta[] | SearchUserResult[]> => {
    const blockedVisibility = await loadViewerBlockedVisibilityOrEmpty(undefined, {
      scope: "SEARCH/REMOTE",
      warningKey: "search-blocked-visibility-load-failed",
    });

    if (type === "events") {
      const events = await EventAPI.getFeed("all");
      return filterBlockedEvents(
        filterEventsLocally(events, clampSearchQuery(q), university, category),
        blockedVisibility,
      ).slice(0, clampSearchLimit(limit));
    }

    if (type === "albums") {
      const albums = await AlbumAPI.getSearchFeed(limit);
      return filterBlockedAlbums(
        filterAlbumsLocally(albums, clampSearchQuery(q)),
        blockedVisibility,
      ).slice(0, clampSearchLimit(limit));
    }

    const normalizedQuery = clampSearchQuery(q);
    const requestedLimit = clampSearchLimit(limit);
    return fallbackSearchProfiles(
      normalizedQuery,
      type,
      university,
      category,
      requestedLimit,
      blockedVisibility,
    );
  },
};
