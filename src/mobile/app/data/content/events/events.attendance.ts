import type { AttendResponse } from "../../contracts/api";
import { supabase } from "../../../platform/supabase";

function hasEventAttendanceWindowEnded(row: {
  ends_at?: string | null;
  is_cancelled?: boolean | null;
}) {
  if (row.is_cancelled) return true;
  const endsAtMs = Date.parse(String(row.ends_at || "").trim());
  return Number.isFinite(endsAtMs) && endsAtMs <= Date.now();
}

async function ensureDirectAttendanceMutationAllowed(eventId: string, desiredJoined: boolean) {
  const { data, error } = await supabase
    .from("events")
    .select("ends_at,is_cancelled")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data || !hasEventAttendanceWindowEnded(data)) {
    return;
  }

  throw new Error(
    desiredJoined
      ? "Etkinlik sona erdiği için artık katılamazsın."
      : "Etkinlik sona erdiği için katılımını geri alamazsın.",
  );
}

export async function readEventAttendanceState(
  eventId: string,
  viewerId: string,
): Promise<AttendResponse | null> {
  const { data, error } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", eventId);
  if (error || !Array.isArray(data)) return null;
  return {
    count: data.length,
    joined: data.some((row) => String(row.user_id || "").trim() === viewerId),
  };
}

export async function reconcileEventAttendanceDirect(
  eventId: string,
  viewerId: string,
  desiredJoined: boolean,
) {
  await ensureDirectAttendanceMutationAllowed(eventId, desiredJoined);
  const writeResult = desiredJoined
    ? await supabase.from("event_attendees").insert({ event_id: eventId, user_id: viewerId })
    : await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", viewerId);
  if (writeResult.error) return null;
  return readEventAttendanceState(eventId, viewerId);
}
