import { supabase } from "../../platform/supabase";

type RawIncomingFollowStatus = "none" | "pending" | "accepted";
type RawIncomingFollowResolution = RawIncomingFollowStatus | "rejected";
type IncomingFollowRequestNotificationRow = {
  request_status?: string | null;
};

async function readIncomingFollowStatus(
  followerId: string,
  followingId: string,
): Promise<RawIncomingFollowStatus> {
  if (!followerId || !followingId) return "none";

  const { data, error } = await supabase
    .from("follows")
    .select("id,status")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (
    error ||
    !Array.isArray(data) ||
    !data.length ||
    !(data[0] as { status?: string } | null)?.status
  ) {
    return "none";
  }
  const rawStatus = String((data[0] as { status?: string }).status)
    .trim()
    .toLowerCase();
  if (rawStatus === "accepted" || rawStatus === "pending") return rawStatus;
  return "none";
}

export async function readIncomingFollowRequestResolution(
  followerId: string,
  followingId: string,
): Promise<RawIncomingFollowResolution> {
  const followStatus = await readIncomingFollowStatus(followerId, followingId);
  if (followStatus !== "none") return followStatus;

  const { data, error } = await supabase
    .from("notifications")
    .select("request_status")
    .eq("user_id", followingId)
    .eq("actor_id", followerId)
    .eq("type", "follow_request")
    .is("deleted_at", null)
    .order("last_activity_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data) || !data.length) {
    return "none";
  }

  const rawStatus = String(
    (data[0] as IncomingFollowRequestNotificationRow | null)?.request_status || "",
  )
    .trim()
    .toLowerCase();
  if (rawStatus === "accepted" || rawStatus === "pending" || rawStatus === "rejected") {
    return rawStatus;
  }
  return "none";
}

export async function acceptIncomingFollowRequestDirect(params: {
  notificationId?: string | null;
  requesterId: string;
  viewerId: string;
}): Promise<boolean> {
  const requesterId = String(params.requesterId || "").trim();
  const viewerId = String(params.viewerId || "").trim();
  if (!requesterId || !viewerId) return false;

  const resolvedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("follows")
    .update({
      responded_at: resolvedAt,
      status: "accepted",
    })
    .eq("follower_id", requesterId)
    .eq("following_id", viewerId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select("id")
    .limit(1);

  if (error || !Array.isArray(data) || data.length === 0) {
    return false;
  }

  const notificationId = String(params.notificationId || "").trim();
  if (notificationId) {
    await supabase
      .from("notifications")
      .update({
        detail: "Takip istegini kabul ettin.",
        is_read: true,
        request_resolved_at: resolvedAt,
        request_status: "accepted",
      })
      .eq("id", notificationId)
      .eq("user_id", viewerId);
  }

  return true;
}
