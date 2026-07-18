import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import type { KvProfileRecord } from "../types.ts";

type FindProfileIdentityOwnerParams = {
  adminSupabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { user_id?: string | null } | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
  field: "email" | "username";
  normalizeEmail: (value: string) => string;
  normalizeUsername: (value: string) => string;
  value: string;
};

type SyncAuthProfileRecordParams = {
  adminSupabase: {
    auth: {
      admin: {
        updateUserById: (
          userId: string,
          payload: { email?: string; user_metadata: Record<string, unknown> },
        ) => Promise<{ error: { message?: string } | null }>;
      };
    };
  };
  buildAuthMetadata: (profile: KvProfileRecord) => Record<string, unknown>;
  context: string;
  logContext?: Record<string, unknown>;
  nextProfile: KvProfileRecord;
  previousEmail?: string;
  userId: string;
};

type SyncCanonicalProfileCacheParams = {
  migrateClubUsernameDependencies: (
    userId: string,
    previousUsername: string,
    nextUsername: string,
  ) => Promise<void>;
  nextProfile: KvProfileRecord;
  normalizeEmail: (value: string) => string;
  normalizeUsername: (value: string) => string;
  previousProfile: KvProfileRecord | null;
  syncClubEventProfileFields: (profile: KvProfileRecord) => Promise<void>;
  userId: string;
};

export async function findProfileIdentityOwner(params: FindProfileIdentityOwnerParams) {
  const normalizedValue =
    params.field === "email"
      ? params.normalizeEmail(params.value || "")
      : params.normalizeUsername(params.value || "");
  if (!normalizedValue) return "";

  const { data, error } = await params.adminSupabase
    .from("profiles")
    .select("user_id")
    .eq(params.field, normalizedValue)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Profile identity lookup failed");
  }

  const kvOwner = await kv.get<string>(`idx:${params.field}:${normalizedValue}`);
  return String(data?.user_id || kvOwner || "").trim();
}

export async function syncAuthProfileRecord(params: SyncAuthProfileRecordParams) {
  const nextEmail = String(params.nextProfile.email || "")
    .trim()
    .toLowerCase();
  const previousEmail = String(params.previousEmail || "")
    .trim()
    .toLowerCase();
  const emailChanged = Boolean(nextEmail && nextEmail !== previousEmail);

  const { error } = await params.adminSupabase.auth.admin.updateUserById(params.userId, {
    ...(emailChanged ? { email: nextEmail } : {}),
    user_metadata: params.buildAuthMetadata(params.nextProfile),
  });

  if (!error) {
    return { fatal: false };
  }

  if (emailChanged) {
    return {
      fatal: true,
      message: error.message || "Auth profile sync failed",
    };
  }

  logError(params.context, "profile-auth-metadata-sync-failed", error, {
    userId: params.userId,
    ...(params.logContext || {}),
  });
  return { fatal: false };
}

export async function syncCanonicalProfileCache(params: SyncCanonicalProfileCacheParams) {
  const previousUsername = params.normalizeUsername(params.previousProfile?.username || "");
  const nextUsername = params.normalizeUsername(params.nextProfile.username || "");
  const previousEmail = params.normalizeEmail(params.previousProfile?.email || "");
  const nextEmail = params.normalizeEmail(params.nextProfile.email || "");

  if (previousUsername && previousUsername !== nextUsername) {
    await kv.del(`idx:username:${previousUsername}`);
  }
  if (nextUsername) {
    await kv.set(`idx:username:${nextUsername}`, params.userId);
  }
  if (previousUsername && previousUsername !== nextUsername) {
    await params.migrateClubUsernameDependencies(params.userId, previousUsername, nextUsername);
  }

  if (previousEmail && previousEmail !== nextEmail) {
    await kv.del(`idx:email:${previousEmail}`);
  }
  if (nextEmail) {
    await kv.set(`idx:email:${nextEmail}`, params.userId);
  }

  await kv.set(`profile:${params.userId}`, params.nextProfile);
  await params.syncClubEventProfileFields(params.nextProfile);
}
