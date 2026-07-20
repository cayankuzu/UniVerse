import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../../platform/supabase";
import type { AccountType } from "../../../data/contracts/api";
import type { AuthUserData } from "../../../data/contracts/entities";
import {
  clearPersistedAuthSession,
  getPersistedAuthSession,
  getPersistedAuthSnapshot,
  savePersistedAuthSession,
  savePersistedAuthSnapshot,
  type PersistedAuthSnapshot,
} from "../../../platform/storage/authSession";
import { getSeededAuthStateFromSession } from "./authSessionSeed";

let restorePersistedSessionPromise: Promise<Session | null> | null = null;
let activeOrPersistedSessionPromise: Promise<Session | null> | null = null;
let activeSessionHint: Session | null = null;

export async function restorePersistedSession(): Promise<Session | null> {
  if (restorePersistedSessionPromise) {
    return restorePersistedSessionPromise;
  }

  const run = (async () => {
    const persistedSession = await getPersistedAuthSession();
    if (!persistedSession) {
      return null;
    }

    const { data, error } = await supabase.auth.setSession(persistedSession);
    if (error || !data.session) {
      await clearPersistedAuthSession();
      return null;
    }

    await persistAuthSession(data.session);
    return data.session;
  })();

  restorePersistedSessionPromise = run;
  try {
    return await run;
  } finally {
    if (restorePersistedSessionPromise === run) {
      restorePersistedSessionPromise = null;
    }
  }
}

export async function persistAuthSession(session: Session | null) {
  activeSessionHint = session;
  if (session) {
    await savePersistedAuthSession(session);
    return;
  }

  await clearPersistedAuthSession();
}

export function forgetActiveSession() {
  activeSessionHint = null;
}

export async function getPersistedAuthBootstrapSnapshot() {
  return getPersistedAuthSnapshot();
}

export async function getActiveOrPersistedSession() {
  if (activeSessionHint) {
    return activeSessionHint;
  }
  if (activeOrPersistedSessionPromise) {
    return activeOrPersistedSessionPromise;
  }

  const run = (async () => {
    const { data } = await supabase.auth.getSession();
    const activeSession = data.session ?? null;

    if (activeSession) {
      await persistAuthSession(activeSession);
      return activeSession;
    }

    return restorePersistedSession();
  })();

  activeOrPersistedSessionPromise = run;
  try {
    return await run;
  } finally {
    if (activeOrPersistedSessionPromise === run) {
      activeOrPersistedSessionPromise = null;
    }
  }
}

export function buildPersistedAuthSnapshot(params: {
  accountType: AccountType;
  isPrivateAccount: boolean;
  userData: AuthUserData;
}): PersistedAuthSnapshot {
  return {
    accountType: params.accountType,
    isPrivateAccount: params.isPrivateAccount,
    userData: {
      ...params.userData,
      categories: [...params.userData.categories],
    },
  };
}

export function buildPersistedAuthSnapshotFromSession(session: Session) {
  const seededState = getSeededAuthStateFromSession(session);
  return buildPersistedAuthSnapshot(seededState);
}

export async function persistResolvedAuthSnapshot(params: {
  accountType: AccountType;
  isPrivateAccount: boolean;
  userData: AuthUserData;
}) {
  await savePersistedAuthSnapshot(buildPersistedAuthSnapshot(params));
}

export async function persistSeededSessionState(session: Session) {
  await persistAuthSession(session);
  await savePersistedAuthSnapshot(buildPersistedAuthSnapshotFromSession(session));
}
