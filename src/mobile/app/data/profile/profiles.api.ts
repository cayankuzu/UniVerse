import type { FollowRequestItem } from "../contracts/api";
import { supabase } from "../../platform/supabase";
import type { UserProfile } from "../contracts/entities";
import {
  getProfileCapabilities,
  getProfileSummary,
  resolveProfileIdByUsername,
} from "./profileLookup";
import { toDisplayName } from "./profileDisplay";
import { timeAgo } from "../../shared/utils/dateTime";
import {
  mapDbProfileToUserProfile,
  normalizeRemoteUserProfile,
  PROFILE_TABLE_SELECT_COLUMNS,
} from "../normalizers/userProfiles";
import { loadProfileMetrics } from "./profileMetrics";

export const ProfileAPI = {
  getByUsername: async (username: string): Promise<UserProfile> => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername) throw new Error("Profile not found");
    const targetUserId = await resolveProfileIdByUsername(normalizedUsername);
    if (targetUserId) {
      const summary = await getProfileSummary(targetUserId);

      if (summary) {
        const summaryProfile = normalizeRemoteUserProfile({
          id: summary.user_id,
          username: summary.username,
          account_type: summary.account_type,
          email: summary.email || "",
          university: summary.university || "",
          categories: Array.isArray(summary.categories) ? summary.categories : [],
          profile_image_path: summary.profile_image_path || "",
          cover_image_path: summary.cover_image_path || "",
          is_private: summary.is_private,
          hide_email: summary.hide_email,
          created_at: summary.created_at || new Date().toISOString(),
          followersCount: Number(summary.followers_count || 0),
          followingCount: Number(summary.following_count || 0),
          albumsCount: Number(summary.albums_count || 0),
          eventsCount: Number(summary.events_count || 0),
          name: summary.name || undefined,
          department: summary.department || undefined,
          grade_year: summary.grade_year || undefined,
          bio: summary.bio || undefined,
          club_name: summary.club_name || undefined,
          description: summary.description || undefined,
        });

        return summaryProfile;
      }

      const { data: canViewData, error: canViewError } = await supabase.rpc("can_view_profile", {
        target_id: targetUserId,
      });

      if (!canViewError && canViewData) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select(PROFILE_TABLE_SELECT_COLUMNS)
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (!error && profile) {
          const metrics = await loadProfileMetrics(targetUserId);
          return mapDbProfileToUserProfile(profile, metrics);
        }
      }
    }

    throw new Error("Profile not found");
  },

  getFollowers: async (username: string): Promise<FollowRequestItem[]> => {
    const targetUserId = await resolveProfileIdByUsername(username);
    if (targetUserId) {
      const capabilities = await getProfileCapabilities(targetUserId);
      if (capabilities && !capabilities.canViewFollowers) {
        return [];
      }

      const { data: rows, error } = await supabase
        .from("follows")
        .select("follower_id,created_at")
        .eq("following_id", targetUserId)
        .eq("status", "accepted")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!error && rows) {
        const followerIds = rows.map((row) => row.follower_id);
        if (followerIds.length === 0) return [];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id,username,name,club_name,profile_image_path,account_type,university")
          .in("user_id", followerIds);

        const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
        const mappedItems = rows
          .map((row) => {
            const profile = profileMap.get(row.follower_id);
            if (!profile) return null;
            return {
              username: profile.username,
              name: toDisplayName(profile),
              image: profile.profile_image_path || "",
              university: profile.university || "",
              accountType: profile.account_type === "club" ? "club" : "student",
              time: timeAgo(row.created_at),
            } as FollowRequestItem;
          })
          .filter((item): item is FollowRequestItem => Boolean(item));
        if (mappedItems.length > 0) return mappedItems;
      }
    }
    return [];
  },

  getFollowing: async (username: string): Promise<FollowRequestItem[]> => {
    const targetUserId = await resolveProfileIdByUsername(username);
    if (targetUserId) {
      const capabilities = await getProfileCapabilities(targetUserId);
      if (capabilities && !capabilities.canViewFollowing) {
        return [];
      }

      const { data: rows, error } = await supabase
        .from("follows")
        .select("following_id,created_at")
        .eq("follower_id", targetUserId)
        .eq("status", "accepted")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!error && rows) {
        const followingIds = rows.map((row) => row.following_id);
        if (followingIds.length === 0) return [];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id,username,name,club_name,profile_image_path,account_type,university")
          .in("user_id", followingIds);

        const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
        const mappedItems = rows
          .map((row) => {
            const profile = profileMap.get(row.following_id);
            if (!profile) return null;
            return {
              username: profile.username,
              name: toDisplayName(profile),
              image: profile.profile_image_path || "",
              university: profile.university || "",
              accountType: profile.account_type === "club" ? "club" : "student",
              time: timeAgo(row.created_at),
            } as FollowRequestItem;
          })
          .filter((item): item is FollowRequestItem => Boolean(item));
        if (mappedItems.length > 0) return mappedItems;
      }
    }
    return [];
  },
};
