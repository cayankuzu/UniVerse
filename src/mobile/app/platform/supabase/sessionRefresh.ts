import { supabase } from "./index";

type RefreshResult = Awaited<ReturnType<typeof supabase.auth.refreshSession>>;

let refreshInFlight: Promise<RefreshResult> | null = null;

/** Shares one Supabase refresh across concurrent 401 recoveries. */
export function refreshSupabaseSessionSingleFlight(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = Promise.resolve(supabase.auth.refreshSession()).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function resetSessionRefreshSingleFlightForTests() {
  refreshInFlight = null;
}
