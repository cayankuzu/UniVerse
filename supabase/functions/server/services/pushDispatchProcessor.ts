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
  type ExpoPushTicket,
  validateExpoPushToken,
} from "./pushNotifications.ts";
import { isSqlBlockedPair } from "./sqlBlockedState.ts";

type NotificationRow = {
  actor_id: string | null;
  deleted_at: string | null;
  id: string;
  is_read: boolean | null;
  request_status: string | null;
  type: string;
  user_id: string;
};

type PushDeliveryLeaseRow = {
  app_env: string;
  delivery_lease_id: string;
  expo_project_id: string | null;
  expo_push_token: string;
  installation_generation: number | null;
  platform: "android" | "ios";
  push_token_id: string;
  recipient_user_id: string;
  token_revision: number;
};

type ProfilePreferencesRow = {
  notification_preferences: Record<string, unknown> | null;
};

type ExistingDeliveryState = {
  error_code: string | null;
  lease_consumed_at: string | null;
  status: string;
};

export interface NotificationPushDispatchProcessResult {
  failedCount: number;
  notificationId: string;
  sentCount: number;
  status: "completed" | "retry" | "skipped";
  errorMessage?: string;
  retryAfterSeconds?: number;
  skippedReason?: string;
}

function normalizePushDeliveryLease(value: unknown): PushDeliveryLeaseRow | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const appEnv = String(item.app_env || "").trim();
  const deliveryLeaseId = String(item.delivery_lease_id || "").trim();
  const expoProjectId = String(item.expo_project_id || "").trim() || null;
  const expoPushToken = String(item.expo_push_token || "").trim();
  const installationGeneration =
    item.installation_generation === null || item.installation_generation === undefined
      ? null
      : Number(item.installation_generation);
  const platform = item.platform === "android" || item.platform === "ios" ? item.platform : null;
  const pushTokenId = String(item.push_token_id || "").trim();
  const recipientUserId = String(item.recipient_user_id || "").trim();
  const tokenRevision = Number(item.token_revision);
  if (
    !deliveryLeaseId ||
    !expoPushToken ||
    !platform ||
    !pushTokenId ||
    !recipientUserId ||
    !Number.isSafeInteger(tokenRevision) ||
    tokenRevision <= 0 ||
    (installationGeneration !== null &&
      (!Number.isSafeInteger(installationGeneration) || installationGeneration <= 0)) ||
    !validateExpoPushToken(expoPushToken)
  ) {
    return null;
  }
  return {
    app_env: appEnv,
    delivery_lease_id: deliveryLeaseId,
    expo_project_id: expoProjectId,
    expo_push_token: expoPushToken,
    installation_generation: installationGeneration,
    platform,
    push_token_id: pushTokenId,
    recipient_user_id: recipientUserId,
    token_revision: tokenRevision,
  };
}

function isAmbiguousProviderOutcome(ticket: ExpoPushTicket) {
  const errorCode = String(ticket.errorCode || "").toLowerCase();
  const message = String(ticket.message || "").toLowerCase();
  return (
    errorCode === "malformedexpoticket" ||
    message.includes("missing-expo-ticket") ||
    message.includes("expo-ok-ticket-missing-id") ||
    (Boolean(ticket.transportError) && ticket.transportStatus === undefined)
  );
}

export async function processNotificationPushDispatch(params: {
  adminSupabase: SupabaseClient;
  notificationId: string;
}): Promise<NotificationPushDispatchProcessResult> {
  const { adminSupabase, notificationId } = params;
  const { data: notificationData, error: notificationError } = await adminSupabase
    .from("notifications")
    .select("id,user_id,actor_id,type,is_read,deleted_at,request_status")
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

  const preferencesResult = await adminSupabase
    .from("profiles")
    .select("notification_preferences")
    .eq("user_id", notification.user_id)
    .maybeSingle();

  if (preferencesResult.error) {
    const dependencyMessage = preferencesResult.error.message || "push-preferences-load-failed";
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
  if (!isPushEnabled(preferences?.notification_preferences || null)) {
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "push-disabled",
    };
  }

  const dispatchEnv = resolvePushDispatchEnv();
  const { data: claimedLeaseData, error: claimError } = await adminSupabase.rpc(
    "claim_notification_push_delivery_leases",
    {
      p_app_env: dispatchEnv,
      p_notification_id: notification.id,
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

  const rawClaimedLeases = Array.isArray(claimedLeaseData) ? claimedLeaseData : [];
  const claimedLeases = rawClaimedLeases
    .map(normalizePushDeliveryLease)
    .filter(
      (item): item is PushDeliveryLeaseRow =>
        item !== null &&
        item.app_env === dispatchEnv &&
        item.recipient_user_id === notification.user_id,
    );
  if (claimedLeases.length !== rawClaimedLeases.length) {
    return {
      failedCount: Math.max(1, rawClaimedLeases.length - claimedLeases.length),
      notificationId,
      sentCount: 0,
      status: "retry",
      errorMessage: "push-delivery-claim-result-invalid",
    };
  }
  if (claimedLeases.length === 0) {
    const { data: existingDeliveryData, error: existingDeliveryError } = await adminSupabase
      .from("notification_push_deliveries")
      .select("status,error_code,lease_consumed_at")
      .eq("notification_id", notification.id)
      .is("ticket_id", null)
      .in("status", ["pending", "error"]);
    if (existingDeliveryError) {
      return {
        failedCount: 1,
        notificationId,
        sentCount: 0,
        status: "retry",
        errorMessage: existingDeliveryError.message || "push-delivery-state-load-failed",
      };
    }
    const hasUnresolvedProviderOutcome = (
      (existingDeliveryData || []) as ExistingDeliveryState[]
    ).some(
      (delivery) =>
        delivery.status === "pending" ||
        delivery.error_code === "MalformedExpoTicket" ||
        delivery.error_code === "ProviderOutcomeUnknown",
    );
    if (hasUnresolvedProviderOutcome) {
      return {
        failedCount: 1,
        notificationId,
        sentCount: 0,
        status: "retry",
        errorMessage: "push-provider-outcome-unconfirmed",
      };
    }
    return {
      failedCount: 0,
      notificationId,
      sentCount: 0,
      status: "skipped",
      skippedReason: "no-current-recipient-token",
    };
  }

  let consumeErrorCount = 0;
  const consumedLeases = (
    await Promise.all(
      claimedLeases.map(async (claimedLease) => {
        const { data, error } = await adminSupabase.rpc(
          "consume_notification_push_delivery_lease",
          {
            p_delivery_lease_id: claimedLease.delivery_lease_id,
            p_notification_id: notification.id,
            p_push_token_id: claimedLease.push_token_id,
          },
        );
        if (error) {
          consumeErrorCount += 1;
          logError("push/dispatch", "push-delivery-consume-failed", error, {
            notificationId: notification.id,
            pushTokenId: claimedLease.push_token_id,
          });
          return null;
        }
        const consumed = normalizePushDeliveryLease(Array.isArray(data) ? data[0] : data);
        if (
          !consumed ||
          consumed.app_env !== dispatchEnv ||
          consumed.delivery_lease_id !== claimedLease.delivery_lease_id ||
          consumed.push_token_id !== claimedLease.push_token_id ||
          consumed.recipient_user_id !== notification.user_id ||
          consumed.token_revision !== claimedLease.token_revision
        ) {
          return null;
        }
        return consumed;
      }),
    )
  ).filter((item): item is PushDeliveryLeaseRow => Boolean(item));

  if (consumedLeases.length === 0) {
    return consumeErrorCount > 0
      ? {
          failedCount: consumeErrorCount,
          notificationId,
          sentCount: 0,
          status: "retry",
          errorMessage: "push-delivery-consume-failed",
        }
      : {
          failedCount: 0,
          notificationId,
          sentCount: 0,
          status: "skipped",
          skippedReason: "recipient-token-changed-before-send",
        };
  }

  const pushMessages = consumedLeases.map((token) => ({
    message: {
      body: buildPushBody(notification),
      channelId: token.platform === "android" ? "default" : undefined,
      data: buildPushData(notification),
      sound: "default" as const,
      title: buildPushTitle(notification.type, null),
      to: token.expo_push_token,
    },
    projectId: token.expo_project_id,
  }));

  const dispatchResult = await sendExpoPushBatchesByProject(pushMessages);
  const persistenceResults = await Promise.all(
    consumedLeases.map(async (token, index) => {
      const ticket = dispatchResult.tickets[index] || {
        message: dispatchResult.transportError || "missing-expo-ticket",
        status: "error" as const,
      };
      const retryable =
        ticket.status === "error" && isRetryablePushTicketError(ticket, ticket.transportError);
      const ambiguous = ticket.status === "error" && isAmbiguousProviderOutcome(ticket);
      const releaseForRetry = retryable && !ambiguous;
      const deactivateToken = ticket.status === "error" && isRecoverableInactiveTokenError(ticket);
      const { data: finalized, error: finalizationError } = await adminSupabase.rpc(
        "finalize_notification_push_delivery",
        {
          p_deactivate_token: deactivateToken,
          p_delivery_lease_id: token.delivery_lease_id,
          p_error_code:
            ticket.status === "error"
              ? ticket.errorCode || (ambiguous ? "ProviderOutcomeUnknown" : null)
              : null,
          p_error_message:
            ticket.status === "error" ? ticket.message || ticket.transportError || null : null,
          p_notification_id: notification.id,
          p_push_token_id: token.push_token_id,
          p_release_for_retry: releaseForRetry,
          p_response: ticket,
          p_status: ticket.status === "ok" ? "pending" : "error",
          p_ticket_id: ticket.status === "ok" ? ticket.ticketId : null,
          p_token_revision: token.token_revision,
        },
      );
      const finalizationConfirmed = finalized === true;
      if (finalizationError || !finalizationConfirmed) {
        logError(
          "push/dispatch",
          "push-delivery-finalization-failed",
          finalizationError || new Error("Push delivery finalization was not confirmed."),
          {
            notificationId: notification.id,
            pushTokenId: token.push_token_id,
          },
        );
      }
      return { finalizationConfirmed, ticket };
    }),
  );

  const dbProofFailureCount = persistenceResults.filter(
    (result) => !result.finalizationConfirmed,
  ).length;
  const sentCount = persistenceResults.filter(
    (result) => result.finalizationConfirmed && result.ticket.status === "ok",
  ).length;
  const providerFailureCount = dispatchResult.tickets.filter(
    (ticket) => ticket.status === "error",
  ).length;
  const failedCount = providerFailureCount + consumeErrorCount + dbProofFailureCount;
  const retryableFailureCount = dispatchResult.tickets.filter(
    (ticket) =>
      ticket.status === "error" && isRetryablePushTicketError(ticket, ticket.transportError),
  ).length;
  const retryAfterSeconds = dispatchResult.tickets.reduce(
    (maximum, ticket) =>
      ticket.status === "error" &&
      isRetryablePushTicketError(ticket, ticket.transportError) &&
      Number.isFinite(ticket.retryAfterSeconds)
        ? Math.max(maximum, Math.ceil(ticket.retryAfterSeconds || 0))
        : maximum,
    0,
  );

  logInfo("push/dispatch", "push-dispatch-finished", {
    failedCount,
    notificationId: notification.id,
    retryableFailureCount,
    consumeErrorCount,
    dbProofFailureCount,
    sentCount,
    transportError: dispatchResult.transportError,
    transportStatus: dispatchResult.transportStatus,
  });

  if (retryableFailureCount > 0 || consumeErrorCount > 0 || dbProofFailureCount > 0) {
    return {
      failedCount,
      notificationId,
      sentCount,
      status: "retry",
      errorMessage:
        dbProofFailureCount > 0
          ? "push-delivery-finalization-failed"
          : dispatchResult.transportError ||
            (consumeErrorCount > 0
              ? "push-delivery-consume-failed"
              : "retryable-push-ticket-failure"),
      ...(retryAfterSeconds > 0 ? { retryAfterSeconds } : {}),
    };
  }

  return {
    failedCount,
    notificationId,
    sentCount,
    status: "completed",
  };
}
