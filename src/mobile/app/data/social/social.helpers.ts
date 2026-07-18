import { startObservedTimer } from "../../platform/observability";
import { debugWarn } from "../../platform/logging/logger";
import { supabase } from "../../platform/supabase";
import { resolveProfileIdByUsername } from "../profile/profileLookup";

type SocialTelemetryTarget = "block" | "follow";

export type SocialMutationContext = {
  targetUserId: string;
  viewerId: string;
};

type SocialMutationOutcome<T> = {
  result: T;
  successMeta?: Record<string, unknown>;
};

type RunObservedSocialMutationParams<T> = {
  fallback: T;
  missingTargetMeta?: Record<string, unknown>;
  missingViewerMeta?: Record<string, unknown>;
  mutationName: string;
  run: (context: SocialMutationContext) => Promise<SocialMutationOutcome<T> | null>;
  throwOnFailure?: boolean;
  telemetryTarget: SocialTelemetryTarget;
  username: string;
  targetUserIdHint?: string | null;
};

export async function readAuthenticatedUserId(): Promise<string | null> {
  const sessionResult = supabase.auth.getSession
    ? await supabase.auth.getSession().catch((error) => {
        debugWarn("SOCIAL", "session-user-read-failed", {
          message: String(
            (error as { message?: string } | null)?.message || "session-user-read-failed",
          ),
        });
        return null;
      })
    : null;
  const sessionUserId = String(sessionResult?.data.session?.user?.id || "").trim();
  if (sessionUserId) return sessionUserId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return String(user?.id || "").trim() || null;
}

export async function resolveSocialTargetUserId(
  username: string,
  targetUserIdHint?: string | null,
): Promise<string | null> {
  return String(targetUserIdHint || "").trim() || (await resolveProfileIdByUsername(username));
}

export async function readProfilesByUserIds<T extends { user_id: string }>(
  userIds: Array<string | null | undefined>,
  columns: string,
): Promise<T[]> {
  const normalizedUserIds = [
    ...new Set(userIds.map((value) => String(value || "").trim()).filter(Boolean)),
  ];
  if (normalizedUserIds.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select(columns)
    .in("user_id", normalizedUserIds)
    .is("deleted_at", null);

  if (error || !Array.isArray(data)) return [];
  return data as unknown as T[];
}

export async function disconnectMutualFollowState(params: {
  targetUserId: string;
  viewerId: string;
}) {
  const viewerId = String(params.viewerId || "").trim();
  const targetUserId = String(params.targetUserId || "").trim();
  if (!viewerId || !targetUserId || viewerId === targetUserId) {
    return false;
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${viewerId},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${viewerId})`,
    );

  return !error;
}

export async function runObservedSocialMutation<T>(
  params: RunObservedSocialMutationParams<T>,
): Promise<T> {
  const stopTelemetry = startObservedTimer({
    category: "mutation",
    meta: { target: params.telemetryTarget, username: params.username },
    name: params.mutationName,
  });

  const viewerId = await readAuthenticatedUserId();
  if (!viewerId) {
    stopTelemetry("error", params.missingViewerMeta || { source: "missing-user" });
    if (params.throwOnFailure) {
      throw new Error("Unauthorized");
    }
    return params.fallback;
  }

  const targetUserId = await resolveSocialTargetUserId(params.username, params.targetUserIdHint);
  if (!targetUserId) {
    stopTelemetry("error", params.missingTargetMeta || { source: "missing-target-user-id" });
    if (params.throwOnFailure) {
      throw new Error("Target profile not found");
    }
    return params.fallback;
  }

  let capturedError: unknown = null;
  try {
    const outcome = await params.run({ targetUserId, viewerId });
    if (outcome) {
      stopTelemetry("ok", outcome.successMeta);
      return outcome.result;
    }
  } catch (error) {
    capturedError = error;
  }

  stopTelemetry("error", {
    source: "mutation-failed",
    ...(capturedError
      ? {
          message: String(
            (capturedError as { message?: string })?.message || capturedError || "",
          ).slice(0, 160),
        }
      : null),
  });
  if (params.throwOnFailure) {
    if (capturedError instanceof Error) throw capturedError;
    throw new Error(`${params.mutationName} failed`);
  }
  return params.fallback;
}
