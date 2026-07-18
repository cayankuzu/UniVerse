import type { SortOption } from "./types";

type SearchEventLike = {
  attendees?: number;
  clubUsername?: string;
  comments?: number;
  createdAt?: string;
  date?: string;
  likes?: number;
  startDate?: string;
};

type SearchAlbumLike = {
  comments?: number;
  createdAt?: string;
  images?: unknown[];
  likes?: number;
};

type SearchUserLike = {
  createdAt?: string;
  id?: string;
  name?: string;
  username?: string;
};

export function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function includesQuery(values: Array<string | undefined>, query: string) {
  const q = normalize(query);
  if (!q) return true;
  return values.some((item) => normalize(item || "").includes(q));
}

export function sortEvents<T extends SearchEventLike>(list: T[], sortOption: SortOption) {
  const next = [...list];
  next.sort((a, b) => {
    if (sortOption === "most_liked") return (b.likes || 0) - (a.likes || 0);
    if (sortOption === "most_comments") return (b.comments || 0) - (a.comments || 0);
    if (sortOption === "most_attended") return (b.attendees || 0) - (a.attendees || 0);
    if (sortOption === "date_asc") {
      return (
        new Date(a.startDate || a.date || "").getTime() -
        new Date(b.startDate || b.date || "").getTime()
      );
    }
    if (sortOption === "date_desc") {
      return (
        new Date(b.startDate || b.date || "").getTime() -
        new Date(a.startDate || a.date || "").getTime()
      );
    }

    const aTime = new Date(a.createdAt || a.date || "").getTime();
    const bTime = new Date(b.createdAt || b.date || "").getTime();
    return sortOption === "oldest" ? aTime - bTime : bTime - aTime;
  });
  return next;
}

export function sortAlbums<T extends SearchAlbumLike>(list: T[], sortOption: SortOption) {
  const next = [...list];
  next.sort((a, b) => {
    if (sortOption === "most_liked") return (b.likes || 0) - (a.likes || 0);
    if (sortOption === "most_comments") return (b.comments || 0) - (a.comments || 0);
    if (sortOption === "most_photos") {
      return ((b.images?.length || 1) as number) - ((a.images?.length || 1) as number);
    }
    const aTime = new Date(a.createdAt || "").getTime();
    const bTime = new Date(b.createdAt || "").getTime();
    return sortOption === "oldest" ? aTime - bTime : bTime - aTime;
  });
  return next;
}

function resolveSearchUserName(item: SearchUserLike) {
  return normalize(String(item.name || item.username || ""));
}

export function sortSearchUsers<T extends SearchUserLike>(list: T[], sortOption: SortOption) {
  const next = [...list];
  next.sort((a, b) => {
    if (sortOption === "alphabetical_asc") {
      return resolveSearchUserName(a).localeCompare(resolveSearchUserName(b), "tr");
    }
    if (sortOption === "alphabetical_desc") {
      return resolveSearchUserName(b).localeCompare(resolveSearchUserName(a), "tr");
    }

    const aTime = new Date(a.createdAt || "").getTime();
    const bTime = new Date(b.createdAt || "").getTime();
    return sortOption === "oldest" ? aTime - bTime : bTime - aTime;
  });
  return next;
}
