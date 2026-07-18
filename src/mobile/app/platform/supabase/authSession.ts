import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

const AUTH_RECOVERY_DELAYS_MS = [0, 180, 420, 900];

export type RecoveredAuthState = {
  accessToken: string | null;
  user: User | null;
};

function mergeAuthState(
  current: RecoveredAuthState,
  next: Partial<RecoveredAuthState>,
): RecoveredAuthState {
  return {
    accessToken: next.accessToken || current.accessToken,
    user: next.user || current.user,
  };
}

async function readSessionState(): Promise<RecoveredAuthState> {
  const sessionResult = await supabase.auth.getSession?.().catch(() => null);
  const session = sessionResult?.data.session || null;
  return {
    accessToken: session?.access_token || null,
    user: session?.user || null,
  };
}

async function readUser(accessToken?: string | null) {
  const getUser = supabase.auth.getUser;
  if (typeof getUser !== "function") return null;
  const userResult = await getUser(accessToken || undefined).catch(() => null);
  return userResult?.data.user || null;
}

async function refreshAuthState(): Promise<RecoveredAuthState> {
  const refreshResult = await supabase.auth.refreshSession?.().catch(() => null);
  const session = refreshResult?.data.session || null;
  return {
    accessToken: session?.access_token || null,
    user: session?.user || null,
  };
}

async function waitForNextAttempt(ms: number) {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function recoverAuthState(): Promise<RecoveredAuthState> {
  let lastState: RecoveredAuthState = {
    accessToken: null,
    user: null,
  };

  for (const delayMs of AUTH_RECOVERY_DELAYS_MS) {
    await waitForNextAttempt(delayMs);

    lastState = mergeAuthState(lastState, await readSessionState());
    if (!lastState.user?.id) {
      lastState = mergeAuthState(lastState, {
        user: await readUser(lastState.accessToken),
      });
    }
    if (lastState.accessToken && lastState.user?.id) {
      return lastState;
    }

    lastState = mergeAuthState(lastState, await refreshAuthState());
    if (!lastState.user?.id) {
      lastState = mergeAuthState(lastState, {
        user: await readUser(lastState.accessToken),
      });
    }
    if (lastState.accessToken && lastState.user?.id) {
      return lastState;
    }
  }

  return lastState;
}

export async function getRecoveredAccessToken() {
  const currentSessionState = await readSessionState();
  if (currentSessionState.accessToken) {
    return currentSessionState.accessToken;
  }

  for (const delayMs of AUTH_RECOVERY_DELAYS_MS) {
    await waitForNextAttempt(delayMs);

    const sessionState = await readSessionState();
    if (sessionState.accessToken) {
      return sessionState.accessToken;
    }

    const refreshedState = await refreshAuthState();
    if (refreshedState.accessToken) {
      return refreshedState.accessToken;
    }
  }

  return null;
}

export async function getRecoveredAuthUser() {
  const currentSessionState = await readSessionState();
  if (currentSessionState.user?.id) {
    return currentSessionState.user;
  }

  const currentUser = await readUser(currentSessionState.accessToken);
  if (currentUser?.id) {
    return currentUser;
  }

  return (await recoverAuthState()).user;
}
