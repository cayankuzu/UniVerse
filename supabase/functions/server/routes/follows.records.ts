import type {
  KvFollowRecord,
  KvFollowRequestRecord,
  KvProfileRecord,
  NotificationInsertPayload,
} from "../types.ts";
import { CompatRouteValidationError } from "./compatRouteValidation.ts";

export function targetRequiresFollowRequest(profile: KvProfileRecord | null) {
  return profile?.accountType !== "club" && Boolean(profile?.isPrivate);
}

export function toFollowRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof CompatRouteValidationError) {
    return { message: error.message, status: error.status };
  }
  return { message: fallbackMessage, status: 500 };
}

export function buildFollowNotification(
  profile: KvProfileRecord | null,
  userId: string,
  message: string,
  type: "follow" | "follow_accepted" = "follow",
): NotificationInsertPayload {
  return {
    fromImage: profile?.profileImage || "",
    fromName: profile?.name || profile?.clubName || "",
    fromUserId: userId,
    fromUsername: profile?.username || "",
    message,
    targetType: "profile",
    type,
  };
}

export function buildFollowListRecord(
  profile: KvProfileRecord | null,
  userId: string,
  username: string,
): KvFollowRecord {
  return {
    accountType: profile?.accountType || "student",
    image: profile?.profileImage || "",
    name: profile?.name || profile?.clubName || "",
    university: profile?.university || "",
    userId,
    username,
  };
}

export function buildFollowRequestRecord(
  profile: KvProfileRecord | null,
  userId: string,
  username: string,
): KvFollowRequestRecord {
  return {
    fromAccountType: profile?.accountType || "student",
    fromImage: profile?.profileImage || "",
    fromName: profile?.name || profile?.clubName || "",
    fromUserId: userId,
    fromUsername: profile?.username || username,
    sentAt: new Date().toISOString(),
  };
}

export function buildOutgoingFollowRequestRecord(
  targetUserId: string,
  username: string,
): KvFollowRequestRecord {
  return {
    sentAt: new Date().toISOString(),
    toUserId: targetUserId,
    toUsername: username,
  };
}
