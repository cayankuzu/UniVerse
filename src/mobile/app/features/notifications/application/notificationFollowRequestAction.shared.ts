import type { QueryKey } from "@tanstack/react-query";
import type { NotificationItem } from "../../../data/contracts/api";
import type { RequestAction } from "../domain/followRequestState";

export type PendingFollowActions = Record<string, RequestAction>;
export type PushNotice = (text: string, kind?: "error" | "info") => void;
export type ViewerIdentity = {
  id?: string;
  username: string;
};

export function normalizeFollowRequestUsername(username?: string | null) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

export function resolveFollowRequestRequesterIdHint(userId?: string | null) {
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId || undefined;
}

export interface UseNotificationFollowRequestActionsParams {
  badgeKey: QueryKey;
  notifications: NotificationItem[];
  notificationsKey: QueryKey;
  pushNotice: PushNotice;
  unreadNotificationCount: number;
  userData: ViewerIdentity;
  viewerKey: string;
}

export function applyPendingActionState(
  current: PendingFollowActions,
  key: string,
  action?: RequestAction,
) {
  if (!action) {
    if (!(key in current)) return current;
    const next = { ...current };
    delete next[key];
    return next;
  }
  return { ...current, [key]: action };
}

export function applyProcessedActionState(
  current: PendingFollowActions,
  key: string,
  action: RequestAction,
) {
  if (current[key] === action) return current;
  return { ...current, [key]: action };
}
