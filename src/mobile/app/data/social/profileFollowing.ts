import type { FollowRequestItem } from "../contracts/api";
import { supabase } from "../../platform/supabase";
import { getProfileCapabilities, resolveProfileIdByUsername } from "../profile/profileLookup";
import { toDisplayName } from "../profile/profileDisplay";
import { timeAgo } from "../../shared/utils/dateTime";

export async function getFollowingProfiles(username: string): Promise<FollowRequestItem[]> {
  const normalizedUsername = String(username || "")
    .trim()
    .toLowerCase();
  if (!normalizedUsername) return [];

  const targetUserId = await resolveProfileIdByUsername(normalizedUsername);
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
}
