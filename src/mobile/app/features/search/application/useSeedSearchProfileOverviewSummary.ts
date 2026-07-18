import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import type { ProfileOverviewProjection } from "../../../data/projections/projections.types";
import { normalizeImageVariants } from "../../../data/normalizers/media";

export type SearchProfileSummarySeed = {
  accountType?: "club" | "student";
  bio?: string;
  categories?: string[];
  coverImage?: string;
  coverImageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  };
  createdAt?: string;
  department?: string;
  description?: string;
  id: string;
  image: string;
  imageVariants?: {
    full?: string | null;
    medium?: string | null;
    thumbnail?: string | null;
  };
  isPrivate: boolean;
  name: string;
  university: string;
  username: string;
  year?: string;
};

type UseSeedSearchProfileOverviewSummaryParams = {
  queryClient: QueryClient;
  viewerKey: string;
};

export function useSeedSearchProfileOverviewSummary(
  params: UseSeedSearchProfileOverviewSummaryParams,
) {
  return useCallback(
    (item: SearchProfileSummarySeed) => {
      const username = String(item.username || "")
        .trim()
        .toLowerCase();
      if (!username) return;

      const queryKey = projectionKeys.profileOverview(username, params.viewerKey);
      const existing = params.queryClient.getQueryData<ProfileOverviewProjection>(queryKey) || null;
      const accountType =
        item.accountType === "club"
          ? "club"
          : item.accountType === "student"
            ? "student"
            : existing?.profile.accountType || "student";
      const profile = {
        ...existing?.profile,
        id: String(item.id || existing?.profile.id || username),
        username,
        accountType,
        email: String(existing?.profile.email || ""),
        university: String(item.university || existing?.profile.university || ""),
        categories:
          (Array.isArray(item.categories) ? item.categories : existing?.profile.categories) || [],
        profileImage: String(item.image || existing?.profile.profileImage || ""),
        coverImage: String(item.coverImage || existing?.profile.coverImage || ""),
        profileImageVariants:
          normalizeImageVariants(item.imageVariants) || existing?.profile.profileImageVariants,
        coverImageVariants:
          normalizeImageVariants(item.coverImageVariants) || existing?.profile.coverImageVariants,
        isPrivate: Boolean(item.isPrivate ?? existing?.profile.isPrivate),
        hideEmail: Boolean(existing?.profile.hideEmail),
        createdAt: String(item.createdAt || existing?.profile.createdAt || ""),
        followersCount: Number(existing?.profile.followersCount || 0),
        followingCount: Number(existing?.profile.followingCount || 0),
        albumsCount: existing?.profile.albumsCount,
        eventsCount: existing?.profile.eventsCount,
        name:
          accountType === "student"
            ? String(item.name || existing?.profile.name || "")
            : existing?.profile.name,
        clubName:
          accountType === "club"
            ? String(item.name || existing?.profile.clubName || username)
            : existing?.profile.clubName,
        department: String(item.department || existing?.profile.department || ""),
        gradeYear: String(item.year || existing?.profile.gradeYear || ""),
        bio: String(item.bio || existing?.profile.bio || ""),
        description: String(item.description || existing?.profile.description || ""),
      };

      params.queryClient.setQueryData<ProfileOverviewProjection>(queryKey, {
        capabilities: existing?.capabilities || null,
        followStatus: existing?.followStatus || "none",
        id: profile.id,
        profile,
        username,
      });
    },
    [params.queryClient, params.viewerKey],
  );
}
