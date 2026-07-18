import type { AccountType } from "../contracts/api";
import type { FollowStatusResponse } from "../contracts/api";
import { supabase } from "../../platform/supabase";
import { readCanonicalFollowStatus } from "./social.status";

type FollowProfileRow = {
  account_type?: AccountType | null;
  is_private?: boolean | null;
};

export function isDesiredFollowStatusSatisfied(
  latestStatus: FollowStatusResponse["status"],
  desiredStatus: FollowStatusResponse["status"] | null | undefined,
) {
  if (!desiredStatus) return false;
  if (desiredStatus === "none") return latestStatus === "none";
  if (desiredStatus === "requested") {
    return latestStatus === "requested" || latestStatus === "following";
  }
  return latestStatus === "following";
}

export function canUseLegacyToggleForDesiredStatus(
  previousStatus: FollowStatusResponse["status"],
  desiredStatus: FollowStatusResponse["status"] | null | undefined,
) {
  if (!desiredStatus) return true;
  if (desiredStatus === "none") {
    return previousStatus === "following" || previousStatus === "requested";
  }
  return previousStatus === "none";
}

export async function reconcileFollowStatusDirect(params: {
  desiredStatus: FollowStatusResponse["status"];
  targetIsPrivate?: boolean | null;
  targetUserId: string;
  username: string;
  viewerId: string;
}) {
  const { error: deleteError } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", params.viewerId)
    .eq("following_id", params.targetUserId);
  if (deleteError) return null;

  if (params.desiredStatus === "none") {
    return readCanonicalFollowStatus(params.username, params.viewerId, params.targetUserId);
  }

  let targetPrivate = typeof params.targetIsPrivate === "boolean" ? params.targetIsPrivate : null;
  if (targetPrivate === null) {
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("account_type,is_private")
      .eq("user_id", params.targetUserId)
      .maybeSingle();
    if (profileError) return null;
    const profile = (profileRow || null) as FollowProfileRow | null;
    targetPrivate = profile?.account_type === "club" ? false : Boolean(profile?.is_private);
  }

  const nextStatus = targetPrivate ? "pending" : "accepted";
  const { error: insertError } = await supabase.from("follows").insert({
    follower_id: params.viewerId,
    following_id: params.targetUserId,
    responded_at: nextStatus === "accepted" ? new Date().toISOString() : null,
    status: nextStatus,
  });
  if (insertError) return null;

  return readCanonicalFollowStatus(params.username, params.viewerId, params.targetUserId);
}
