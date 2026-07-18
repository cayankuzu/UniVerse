import { createContext, useContext, type ReactNode } from "react";
export { profileToUserData } from "../../../data/normalizers/profileUserData";

export type AccountType = "student" | "club";
export type AuthBootState = "booting" | "signed_out" | "signed_in_seeded" | "signed_in_hydrated";

export type PendingVerification = {
  data: unknown;
  email: string;
  type: AccountType;
} | null;

export interface UserData {
  albums?: number;
  bio?: string;
  categories: string[];
  clubName?: string;
  coverImage: string;
  department?: string;
  description?: string;
  email: string;
  events: number;
  followers: number;
  following: number;
  gradeYear?: string;
  hideEmail?: boolean;
  id?: string;
  isPrivate?: boolean;
  name?: string;
  profileImage: string;
  university: string;
  username: string;
}

export interface AuthContextType {
  accountType: AccountType;
  authBootState: AuthBootState;
  blockedUsers: string[];
  blockUser: (username: string, options?: { targetUserId?: string | null }) => Promise<void>;
  deleteAccount: () => Promise<void>;
  isAuthBootstrapPending: boolean;
  isBlocked: (username: string) => boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  isLoggedIn: boolean;
  isPrivateAccount: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: (type: AccountType) => void;
  logout: () => Promise<void>;
  pendingVerification: PendingVerification;
  setIsPrivateAccount: (value: boolean) => void;
  setPendingVerification: (value: PendingVerification) => void;
  unblockUser: (username: string, options?: { targetUserId?: string | null }) => Promise<void>;
  updateUserData: (data: Partial<UserData>) => void;
  userData: UserData;
}

export type AuthProviderProps = { children: ReactNode };

export const AuthContext = createContext<AuthContextType | null>(null);

export function useRequiredAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export const DEMO_MODE_KEY = "UNiETAS_demo_mode";
export const DEMO_DATA_KEY = "UNiETAS_demo_data";
export const AUTH_STORAGE_VERSION_KEY = "UNiETAS_auth_storage_version";
export const AUTH_STORAGE_VERSION = "2026-03-11-auth-v3";
export const SESSION_HYDRATE_TIMEOUT_MS = 12000;
export const SESSION_REFRESH_TIMEOUT_MS = 10000;
export const LOGIN_STEP_TIMEOUT_MS = 15000;
export const LOGIN_PROFILE_SYNC_WAIT_MS = 800;
export const AUTH_BOOT_TIMEOUT_MS = 3200;
export const AUTH_BOOT_SESSION_TIMEOUT_MS = 1500;

export const defaultUserData: UserData = {
  username: "",
  name: "",
  email: "",
  university: "",
  profileImage: "",
  coverImage: "",
  categories: [],
  followers: 0,
  following: 0,
  albums: 0,
  events: 0,
  hideEmail: false,
};

export function toErrorMessage(error: unknown) {
  return String((error as { message?: string })?.message || error || "unknown");
}

export function shouldRetryHydrationWithRefresh(error: unknown) {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("invalid jwt") ||
    message.includes("jwt") ||
    message.includes("token") ||
    message.includes("session") ||
    message.includes("auth")
  );
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutCode: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export type RaceWithTimeoutResult<T> = { timedOut: true } | { timedOut: false; value: T };

/**
 * Races a promise against a timeout WITHOUT abandoning the original promise.
 * Unlike `withTimeout`, this never rejects: on timeout it resolves with
 * `{ timedOut: true }` so the caller can unblock the UI immediately while the
 * original promise keeps running in the background and can still be observed
 * (e.g. to hydrate a session that resolves late).
 */
export async function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<RaceWithTimeoutResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise.then((value): RaceWithTimeoutResult<T> => ({ timedOut: false, value })),
      new Promise<RaceWithTimeoutResult<T>>((resolve) => {
        timeoutId = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
