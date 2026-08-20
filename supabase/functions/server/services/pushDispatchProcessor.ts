import type { SupabaseClient } from "npm:@supabase/supabase-js";
import { logError, logInfo } from "../logging.ts";
import {
  buildPushBody,
  buildPushData,
  buildPushTitle,
  isPushEnabled,
  isRecoverableInactiveTokenError,
  isRetryablePushTicketError,
  resolvePushDispatchEnv,
  sendExpoPushBatchesByProject,
  validateExpoPushToken,
} from "./pushNotifications.ts";
import { isSqlBlockedPair } from "./sqlBlockedState.ts";

type NotificationRow = {
  actor_id: string | null;
  created_at: string;
  deleted_at: string | null;
  detail: string | null;
  event_id: string | null;
  id: string;
  is_read: boolean | null;
  message: string;
  photo_id: string | null;
  request_status: string | null;
  target_profile_id: string | null;
  type: string;
  user_id: string;
};

type PushTokenRow = {
  app_env: string;
  expo_project_id: string | null;
  expo_push_token: string;
  id: string;
  platform: "android" | "ios";
};

type ProfilePreferencesRow = {
  notification_preferences: Record<string, unknown> | null;
};

type ActorProfileRow = {
  club_name: string | null;
  name: string | null;
  username: string | null;
};

export interface NotificationPushDispatchProcessResult {
  failedCount: number;
  notificationId: string;
  sentCount: number;
  status: "completed" | "retry" | "skipped";
  errorMessage?: string;
  skippedReason?: string;
}

function summarizeDependencyError(errors: {
  actor?: { message?: string } | null;
  preferences?: { message?: string } | null;
  tokens?: { message?: string } | null;
}) {
  return JSON.stringify({
    actor: errors.actor?.message || null,
    preferences: errors.preferences?.message || null,
    tokens: errors.tokens?.message || null,
  });
}

export async function processNotificationPushDispatch(params: {
  adminSupabase: SupabaseClient;
  notificationId: string;
}): Promise<NotificationPushDispatchProcessResult> {
  const { adminSupabase, notificationId } = params;
  const { data: notificationData, error: notificationError } = await adminSupabase
    .from("notifications")
    .select(
      "id,user_id,actor_id,type,message,detail,event_id,photo_id,target_profile_id,created_at,is_read,deleted_at,request_status",
    )
    .eq("id", notificationId)
    .maybeSingle();
  const notification = (notificationData || null) as NotificationRow | null;

  if (notificationError) {
    logError("push/dispatch", "notification-load-failed", notificationError, {
      notificationId,
    });
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "retry",
      errorMessage: notificationError.message,
    };
  }
  if (!notification) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "notification-missing",
    };
  }
  if (notification.deleted_at) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "notification-deleted",
    };
  }
  if (notification.is_read) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "notification-read",
    };
  }
  if (notification.actor_id && notification.user_id === notification.actor_id) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "self-notification",
    };
  }
  if (
    (notification.type === "follow_request" || notification.type === "join_request") &&
    notification.request_status &&
    notification.request_status !== "pending"
  ) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "request-resolved",
    };
  }
  if (
    notification.actor_id &&
    (await isSqlBlockedPair(adminSupabase, notification.user_id, notification.actor_id))
  ) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "blocked-pair",
    };
  }

  const [preferencesResult, actorResult, tokenResult] = await Promise.all([
    adminSupabase
      .from("profiles")
      .select("notification_preferences")
      .eq("user_id", notification.user_id)
      .maybeSingle(),
    notification.actor_id
      ? adminSupabase
          .from("profiles")
          .select("username,name,club_name")
          .eq("user_id", notification.actor_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    adminSupabase
      .from("push_device_tokens")
      .select("id,expo_push_token,platform,app_env,expo_project_id")
      .eq("user_id", notification.user_id)
      .eq("is_active", true)
      .eq("app_env", resolvePushDispatchEnv()),
  ]);

  if (preferencesResult.error || actorResult.error || tokenResult.error) {
    const dependencyMessage = summarizeDependencyError({
      actor: actorResult.error,
      preferences: preferencesResult.error,
      tokens: tokenResult.error,
    });
    logError("push/dispatch", "push-dependencies-load-failed", new Error(dependencyMessage), {
      notificationId,
    });
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "retry",
      errorMessage: dependencyMessage,
    };
  }

  const preferences = (preferencesResult.data || null) as ProfilePreferencesRow | null;
  const actorProfile = (actorResult.data || null) as ActorProfileRow | null;
  if (!isPushEnabled(preferences?.notification_preferences || null)) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "push-disabled",
    };
  }

  const tokens = ((tokenResult.data || []) as PushTokenRow[]).filter((item) =>
    validateExpoPushToken(item.expo_push_token),
  );
  if (tokens.length === 0) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "no-active-tokens",
    };
  }

  const { data: claimedTokenIds, error: claimError } = await adminSupabase.rpc(
    "claim_notification_push_deliveries",
    {
      p_notification_id: notification.id,
      p_push_token_ids: tokens.map((item) => item.id),
    },
  );

  if (claimError) {
    logError("push/dispatch", "push-delivery-claim-failed", claimError, {
      notificationId,
    });
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "retry",
      errorMessage: claimError.message,
    };
  }

  const claimedIdSet = new Set(
    Array.isArray(claimedTokenIds) ? claimedTokenIds.map((item) => String(item || "").trim()) : [],
  );
  const tokensToSend = tokens.filter((item) => claimedIdSet.has(String(item.id || "").trim()));
  if (tokensToSend.length === 0) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "already-dispatched",
    };
  }

  const pushMessages = tokensToSend.map((token) => ({
    message: {
      body: buildPushBody(notification),
      channelId: token.platform === "android" ? "default" : undefined,
      data: buildPushData(notification, actorProfile),
      sound: "default" as const,
      title: buildPushTitle(notification.type, actorProfile, notification),
      to: token.expo_push_token,
    },
    projectId: token.expo_project_id,
  }));

  const dispatchResult = await sendExpoPushBatchesByProject(pushMessages);
  const attemptedAt = new Date().toISOString();

  await Promise.all(
    tokensToSend.map(async (token, index) => {
      const ticket = dispatchResult.tickets[index] || {
        message: dispatchResult.transportError || "missing-expo-ticket",
        status: "error" as const,
      };
      const deliveryPatch =
        ticket.status === "ok"
          ? {
              attempted_at: attemptedAt,
              delivered_at: null,
              error_code: null,
              error_message: null,
              response: ticket,
              status: "pending",
              ticket_id: ticket.ticketId || null,
            }
          : {
              attempted_at: attemptedAt,
              delivered_at: null,
              error_code: ticket.errorCode || null,
              error_message: ticket.message || dispatchResult.transportError || null,
              response: ticket,
              status: "error",
              ticket_id: null,
            };

      const { error: deliveryUpdateError } = await adminSupabase
        .from("notification_push_deliveries")
        .update(deliveryPatch)
        .eq("notification_id", notification.id)
        .eq("push_token_id", token.id);
      if (deliveryUpdateError) {
        logError("push/dispatch", "push-delivery-update-failed", deliveryUpdateError, {
          notificationId: notification.id,
          pushTokenId: token.id,
        });
      }

      if (ticket.status === "error" && isRecoverableInactiveTokenError(ticket)) {
        const { error: deactivateError } = await adminSupabase
          .from("push_device_tokens")
          .update({
            is_active: false,
            last_seen_at: attemptedAt,
          })
          .eq("id", token.id);
        if (deactivateError) {
          logError("push/dispatch", "push-token-deactivate-failed", deactivateError, {
            notificationId: notification.id,
            pushTokenId: token.id,
          });
        }
      }
    }),
  );

  const sentCount = dispatchResult.tickets.filter((ticket) => ticket.status === "ok").length;
  const failedCount = dispatchResult.tickets.length - sentCount;
  const retryableFailureCount = dispatchResult.tickets.filter(
    (ticket) =>
      ticket.status === "error" &&
      isRetryablePushTicketError(ticket, dispatchResult.transportError),
  ).length;

  logInfo("push/dispatch", "push-dispatch-finished", {
    failedCount,
    notificationId: notification.id,
    retryableFailureCount,
    sentCount,
    transportError: dispatchResult.transportError,
    transportStatus: dispatchResult.transportStatus,
  });

  if (retryableFailureCount > 0) {
    return {
      failedCount,
      notificationId,
      sentCount,
      status: "retry",
      errorMessage: dispatchResult.transportError || "retryable-push-ticket-failure",
    };
  }

  return {
    failedCount,
    notificationId,
    sentCount,
    status: "completed",
  };
}
