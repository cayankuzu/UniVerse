import type { SupabaseClient } from "npm:@supabase/supabase-js";
import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import { consumeRateLimit, consumeScopedRateLimit, getRequestClientAddress } from "../rateLimit.ts";
import type {
  EdgeRouteContext,
  KvBlockedRecord,
  KvEventRecord,
  KvProfileRecord,
} from "../types.ts";
import { createBlockedStateReader } from "../services/blockedState.ts";
import { STORAGE_BUCKET } from "./storagePolicy.ts";

let bucketInitPromise: Promise<void> | null = null;

export function normalizeSearchText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function matchesOptionalExact(value: unknown, expected: string) {
  if (!expected) return true;
  return normalizeSearchText(value) === normalizeSearchText(expected);
}

export function isKvProfileRecord(value: KvProfileRecord | null): value is KvProfileRecord {
  return Boolean(value && typeof value === "object");
}

export function isKvEventRecord(value: KvEventRecord | null): value is KvEventRecord {
  return Boolean(value && typeof value === "object");
}

async function initBucket(adminSupabase: SupabaseClient) {
  if (!bucketInitPromise) {
    bucketInitPromise = (async () => {
      try {
        const { data: buckets } = await adminSupabase.storage.listBuckets();
        const bucketExists = buckets?.some(
          (bucket: { name: string }) => bucket.name === STORAGE_BUCKET,
        );
        if (!bucketExists) {
          await adminSupabase.storage.createBucket(STORAGE_BUCKET, { public: false });
        }
      } catch (error) {
        bucketInitPromise = null;
        logError("storage/init-bucket", "bucket-init-failed", error);
      }
    })();
  }
  await bucketInitPromise;
}

async function upsertMediaAssetRecord(
  adminSupabase: SupabaseClient,
  params: {
    checksumSha256?: string | null;
    contentType?: string | null;
    objectPath: string;
    ownerId: string;
    scanCompletedAt?: string | null;
    scanProvider?: string | null;
    scanState?: "failed" | "passed" | "pending";
    sizeBytes?: number | null;
  },
) {
  const { error } = await adminSupabase.from("media_assets").upsert(
    {
      bucket_id: STORAGE_BUCKET,
      checksum_sha256: params.checksumSha256 || null,
      mime_type: params.contentType || null,
      object_path: params.objectPath,
      owner_id: params.ownerId,
      scan_completed_at: params.scanCompletedAt || null,
      scan_provider: params.scanProvider || null,
      scan_state: params.scanState || "pending",
      size_bytes: params.sizeBytes || null,
      visibility: "private",
    },
    { onConflict: "object_path" },
  );
  if (error) {
    throw new Error(error.message);
  }
}

async function resolveKnownStorageOwner(adminSupabase: SupabaseClient, objectPath: string) {
  const mediaAssetRes = await adminSupabase
    .from("media_assets")
    .select("owner_id,scan_state")
    .eq("bucket_id", STORAGE_BUCKET)
    .eq("object_path", objectPath)
    .maybeSingle();
  if (mediaAssetRes.error) throw new Error(mediaAssetRes.error.message);
  if (mediaAssetRes.data?.owner_id) {
    return {
      ownerId: String(mediaAssetRes.data.owner_id).trim(),
      scanState: String(mediaAssetRes.data.scan_state || "pending").trim(),
      source: "media_assets" as const,
    };
  }

  const [profileImageRes, coverImageRes, eventRes, albumPrimaryRes, albumMediaPathRes] =
    await Promise.all([
      adminSupabase
        .from("profiles")
        .select("user_id")
        .eq("profile_image_path", objectPath)
        .maybeSingle(),
      adminSupabase
        .from("profiles")
        .select("user_id")
        .eq("cover_image_path", objectPath)
        .maybeSingle(),
      adminSupabase
        .from("events")
        .select("club_id")
        .eq("cover_image_path", objectPath)
        .maybeSingle(),
      adminSupabase
        .from("album_photos")
        .select("user_id")
        .eq("storage_path", objectPath)
        .maybeSingle(),
      adminSupabase
        .from("album_photos")
        .select("user_id")
        .contains("media_paths", [objectPath])
        .maybeSingle(),
    ]);

  const responses = [profileImageRes, coverImageRes, eventRes, albumPrimaryRes, albumMediaPathRes];
  const errored = responses.find((result) => result.error);
  if (errored?.error) {
    throw new Error(errored.error.message);
  }

  const profileOwner = String(
    profileImageRes.data?.user_id || coverImageRes.data?.user_id || "",
  ).trim();
  if (profileOwner) {
    return { ownerId: profileOwner, scanState: "passed", source: "profiles" as const };
  }

  const eventOwner = String(eventRes.data?.club_id || "").trim();
  if (eventOwner) {
    return { ownerId: eventOwner, scanState: "passed", source: "events" as const };
  }

  const albumOwner = String(
    albumPrimaryRes.data?.user_id || albumMediaPathRes.data?.user_id || "",
  ).trim();
  if (albumOwner) {
    return { ownerId: albumOwner, scanState: "passed", source: "album_photos" as const };
  }

  return null;
}

export function createDiscoveryRouteContext(adminSupabase: SupabaseClient) {
  const loadBlockedRows = (userId: string) =>
    kv.get<KvBlockedRecord[]>(`blocked:${userId}`).then((value) => value || []);

  return {
    createSearchBlockFilters: () => {
      const blockedState = createBlockedStateReader({ loadBlockedRows });
      return {
        filterBlockedEvents: async (viewerId: string, events: KvEventRecord[]) => {
          if (!viewerId || !Array.isArray(events) || events.length === 0) return events;
          const next: KvEventRecord[] = [];
          for (const event of events) {
            const targetId = String(event?.clubUserId || "").trim();
            if (!targetId) continue;
            if (await blockedState.isBlockedPair(viewerId, targetId)) continue;
            next.push(event);
          }
          return next;
        },
        filterBlockedProfiles: async (viewerId: string, profiles: KvProfileRecord[]) => {
          if (!viewerId || !Array.isArray(profiles) || profiles.length === 0) return profiles;
          const next: KvProfileRecord[] = [];
          for (const profile of profiles) {
            const targetId = String(profile?.id || "").trim();
            if (!targetId) continue;
            if (await blockedState.isBlockedPair(viewerId, targetId)) continue;
            next.push(profile);
          }
          return next;
        },
      };
    },
    ensureRateLimitBudget: async (
      c: EdgeRouteContext,
      scope: string,
      userId: string,
      limit: number,
      windowMs: number,
    ) =>
      consumeScopedRateLimit({
        limit,
        scope,
        subjects: [`ip:${getRequestClientAddress(c)}`, userId ? `user:${userId}` : ""],
        windowMs,
      }),
    ensureSplitBudget: async (params: {
      c: EdgeRouteContext;
      ipLimit: number;
      scope: string;
      userId: string;
      userLimit: number;
      windowMs: number;
    }) => {
      const ipAddress = getRequestClientAddress(params.c);
      const [ipAllowed, userAllowed] = await Promise.all([
        consumeRateLimit({
          limit: params.ipLimit,
          scope: `${params.scope}:ip`,
          subject: ipAddress,
          windowMs: params.windowMs,
        }),
        params.userId
          ? consumeRateLimit({
              limit: params.userLimit,
              scope: `${params.scope}:user`,
              subject: params.userId,
              windowMs: params.windowMs,
            })
          : Promise.resolve(true),
      ]);
      return ipAllowed && userAllowed;
    },
    initStorageBucket: () => initBucket(adminSupabase),
    resolveKnownStorageOwner: (objectPath: string) =>
      resolveKnownStorageOwner(adminSupabase, objectPath),
    upsertMediaAssetRecord: (params: {
      checksumSha256?: string | null;
      contentType?: string | null;
      objectPath: string;
      ownerId: string;
      scanCompletedAt?: string | null;
      scanProvider?: string | null;
      scanState?: "failed" | "passed" | "pending";
      sizeBytes?: number | null;
    }) => upsertMediaAssetRecord(adminSupabase, params),
  };
}

export type DiscoveryRouteContext = ReturnType<typeof createDiscoveryRouteContext>;
