import type { FollowStatusResponse } from "../contracts/api";
import { debugWarn } from "../../platform/logging/logger";
import { supabase } from "../../platform/supabase";

type CanonicalFollowStateRow = {
  resolved_user_id?: string | null;
  status?: string | null;
  is_private?: boolean | null;
};

type FollowStatusTableRow = {
  id?: string | null;
  status?: string | null;
};

export function mapFollowStatus(status: string | null | undefined): FollowStatusResponse {
  if (status === "accepted" || status === "following") return { status: "following" };
  if (status === "pending" || status === "requested") return { status: "requested" };
  return { status: "none" };
}

export async function readFollowStatusRow(
  viewerId: string,
  targetUserId: string,
): Promise<FollowStatusResponse> {
  const { data, error } = await supabase
    .from("follows")
    .select("id,status")
    .eq("follower_id", viewerId)
    .eq("following_id", targetUserId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error || !Array.isArray(data) || !data.length) return { status: "none" };
  return mapFollowStatus((data[0] as FollowStatusTableRow | null)?.status);
}

function readCanonicalFollowStateRow(payload: unknown): CanonicalFollowStateRow | null {
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as CanonicalFollowStateRow) : null;
  }
  return payload && typeof payload === "object" ? (payload as CanonicalFollowStateRow) : null;
}

export async function readCanonicalFollowStatus(
  username: string,
  viewerId: string,
  targetUserId: string,
): Promise<FollowStatusResponse> {
  const directStatus = targetUserId ? await readFollowStatusRow(viewerId, targetUserId) : null;
  try {
    const { data, error } = await supabase.rpc("get_follow_state", {
      target_user_id: targetUserId || null,
      target_username: username || null,
    });
    if (error) {
      debugWarn("SOCIAL/STATUS", "canonical-follow-rpc-failed", {
        code: error.code,
        message: error.message,
        username,
      });
    }
    if (!error) {
      const row = readCanonicalFollowStateRow(data);
      if (row) {
        const rpcStatus = mapFollowStatus(row.status);
        if (!directStatus || directStatus.status === rpcStatus.status) {
          return rpcStatus;
        }
        return directStatus;
      }
    }
  } catch (error) {
    debugWarn("SOCIAL/STATUS", "canonical-follow-rpc-threw", {
      message: String((error as { message?: string })?.message || error || "").slice(0, 160),
      username,
    });
  }

  if (directStatus) {
    return directStatus;
  }
  return { status: "none" };
}
