import { buildAppUrl } from "../linking/appUrl";
import {
  readSecureJson,
  removeSecurePersistedValue,
  writeSecureJson,
} from "../storage/securePersist";

const AUTH_REDIRECT_STATE_KEY = "auth-redirect-state:v1";
const AUTH_REDIRECT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type AuthRedirectFlow = "password-reset" | "signup";
export type AuthRedirectTarget = "auth/callback" | "reset-password";

type StoredAuthRedirectState = {
  createdAt: number;
  flow: AuthRedirectFlow;
  state: string;
  target: AuthRedirectTarget;
};

function buildRandomState() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function buildTrackedUrl(target: AuthRedirectTarget, flow: AuthRedirectFlow, state: string) {
  const baseUrl = buildAppUrl(target);
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}flow=${encodeURIComponent(flow)}&state=${encodeURIComponent(state)}`;
}

function isFreshState(value: StoredAuthRedirectState | null): value is StoredAuthRedirectState {
  if (!value) return false;
  return Date.now() - Number(value.createdAt || 0) <= AUTH_REDIRECT_MAX_AGE_MS;
}

export async function createTrackedAuthRedirectUrl(params: {
  flow: AuthRedirectFlow;
  target: AuthRedirectTarget;
}) {
  const state = buildRandomState();
  await writeSecureJson(AUTH_REDIRECT_STATE_KEY, {
    createdAt: Date.now(),
    flow: params.flow,
    state,
    target: params.target,
  } satisfies StoredAuthRedirectState);
  return buildTrackedUrl(params.target, params.flow, state);
}

export async function consumeTrackedAuthRedirectState(params: {
  expectedFlow?: AuthRedirectFlow;
  providedState?: string | null;
  target: AuthRedirectTarget;
}) {
  const storedState = await readSecureJson<StoredAuthRedirectState>(AUTH_REDIRECT_STATE_KEY);
  if (!isFreshState(storedState)) {
    await removeSecurePersistedValue(AUTH_REDIRECT_STATE_KEY);
    return null;
  }
  const stored = storedState;
  const normalizedState = String(params.providedState || "").trim();
  if (!normalizedState || stored.state !== normalizedState || stored.target !== params.target) {
    return null;
  }
  if (params.expectedFlow && stored.flow !== params.expectedFlow) {
    return null;
  }
  await removeSecurePersistedValue(AUTH_REDIRECT_STATE_KEY);
  return stored;
}

export async function clearTrackedAuthRedirectState() {
  await removeSecurePersistedValue(AUTH_REDIRECT_STATE_KEY);
}
