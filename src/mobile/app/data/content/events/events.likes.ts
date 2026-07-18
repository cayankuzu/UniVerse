import type { LikeResponse } from "../../contracts/api";
import { supabase } from "../../../platform/supabase";

export async function readEventLikeState(
  eventId: string,
  viewerId: string,
): Promise<LikeResponse | null> {
  const { data, error } = await supabase
    .from("event_likes")
    .select("user_id")
    .eq("event_id", eventId);
  if (error || !Array.isArray(data)) return null;
  return {
    count: data.length,
    liked: data.some((row) => String(row.user_id || "").trim() === viewerId),
  };
}

export async function reconcileEventLikeDirect(
  eventId: string,
  viewerId: string,
  desiredLiked: boolean,
) {
  const writeResult = desiredLiked
    ? await supabase.from("event_likes").insert({ event_id: eventId, user_id: viewerId })
    : await supabase.from("event_likes").delete().eq("event_id", eventId).eq("user_id", viewerId);
  if (writeResult.error) return null;
  return readEventLikeState(eventId, viewerId);
}
