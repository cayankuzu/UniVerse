import type { ClientMutationOptions } from "../mutations/clientMutation";
import { observeMutation } from "../normalizers/mutationTelemetry";
import { resolveVisibilityFromAccess } from "../policies/eventAccess";
import { createClientMutationId } from "../mutations/clientMutation";
import { toIsoDateTime } from "../../shared/utils/dateTime";
import type {
  AttendResponse,
  LikeResponse,
  SearchUserResult,
  SuccessResponse,
} from "../contracts/api";
import { del, post } from "../../platform/api/core";
import { debugLog } from "../../platform/logging/logger";
import { startObservedTimer } from "../../platform/observability";
import { supabase } from "../../platform/supabase";
import {
  addEventComment,
  getEventCommentLikes,
  getEventComments,
  toggleEventCommentLike,
} from "./events/events.comments";
import { assertEventInteractionAllowed } from "../social/blockedInteractionGuard";
import {
  readEventAttendanceState,
  reconcileEventAttendanceDirect,
} from "./events/events.attendance";
import { normalizeEventCreateErrorMessage } from "./events/events.errors";
import { readEventLikeState, reconcileEventLikeDirect } from "./events/events.likes";
import { persistLocalEventShadow } from "./events/events.local";
import type { CreateEventPayload, EventWithMeta } from "./events/events.models";
import { fetchEventAttendeesFromApi, fetchEventLikesFromApi } from "./events/events.models";
import { getEventAttendeesList, getEventLikesList } from "./events/events.peopleApi";
import {
  getEventById,
  getEventFeed,
  getEventHomeFeed,
  getEventsByClub,
  getProfileEvents,
} from "./events/events.reads";
import {
  extractEventAttendResponse,
  extractEventLikeResponse,
  toEventMutationError,
} from "./events/events.shared";
import { executeEventToggleRpcWithFallback } from "./events/events.toggleRpc";
import { triggerPushDispatchWakeup } from "../notifications/pushDispatchWakeup";

type EventLikeMutationOptions = ClientMutationOptions & {
  desiredLiked?: boolean;
};

type EventAttendanceMutationOptions = ClientMutationOptions & {
  desiredJoined?: boolean;
};

export const EventAPI = {
  getFeed: getEventFeed,
  getHomeFeed: getEventHomeFeed,
  getByClub: getEventsByClub,
  getById: getEventById,
  getProfileEvents,
  create: async (
    payload: CreateEventPayload,
    options?: {
      clientMutationId?: string | null;
      localEventBuilder?: (eventId: string) => EventWithMeta;
    },
  ): Promise<EventWithMeta> => {
    const stopCreateEventTelemetry = startObservedTimer({
      category: "mutation",
      meta: { target: "event" },
      name: "create-event",
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const startsAt = toIsoDateTime(payload.startDate || payload.date, payload.startTime || "10:00");
    const endsAt = toIsoDateTime(
      payload.endDate || payload.startDate || payload.date,
      payload.endTime || "12:00",
    );
    const visibility = resolveVisibilityFromAccess(payload.access);
    const directAddress = payload.address || payload.location || "";
    const clientMutationId =
      options?.clientMutationId ||
      payload.clientMutationId ||
      createClientMutationId("event-create");

    const { data, error } = await supabase.rpc("create_event_with_patch", {
      client_mutation_id: clientMutationId,
      p_access_label: payload.access,
      p_address: directAddress,
      p_capacity: payload.capacity || null,
      p_categories: payload.categories || [],
      p_category: payload.category,
      p_cover_image_path: payload.image || null,
      p_description: payload.description,
      p_ends_at: endsAt,
      p_event_type: payload.type,
      p_fee_label: payload.fee,
      p_level: payload.level || null,
      p_location_name: payload.location,
      p_materials: payload.materials || null,
      p_starts_at: startsAt,
      p_target_audience: payload.targetAudience || null,
      p_title: payload.title,
      p_visibility: visibility,
    });

    const createdEventId = String((data as { id?: string } | null)?.id || "").trim();
    if (!error && createdEventId) {
      const created = options?.localEventBuilder
        ? options.localEventBuilder(createdEventId)
        : await EventAPI.getById(createdEventId);
      await persistLocalEventShadow(created);
      triggerPushDispatchWakeup("event-create");
      stopCreateEventTelemetry("ok", { source: "rpc" });
      return created;
    }

    const directErrorMessage = normalizeEventCreateErrorMessage(error);
    debugLog("EVENTS", "create:rpc-failed", { message: directErrorMessage });

    try {
      const created = await post<EventWithMeta>("/events", {
        ...payload,
        clientMutationId,
        visibility,
      });
      await persistLocalEventShadow(created);
      triggerPushDispatchWakeup("event-create");
      stopCreateEventTelemetry("ok", { source: "edge-sql" });
      return created;
    } catch (fallbackError) {
      const fallbackMessage = normalizeEventCreateErrorMessage(fallbackError);
      stopCreateEventTelemetry("error", { source: "edge-sql", message: fallbackMessage });
      throw new Error(fallbackMessage || directErrorMessage);
    }
  },
  getComments: (eventId: string, options?: { viewerId?: string | null }) =>
    getEventComments(eventId, options),
  addComment: addEventComment,
  toggleCommentLike: (
    commentId: string,
    options?: { clientMutationId?: string | null; desiredLiked?: boolean | null },
  ) => toggleEventCommentLike(commentId, options),
  getCommentLikes: getEventCommentLikes,
  getLikes: async (eventId: string): Promise<SearchUserResult[]> =>
    getEventLikesList(eventId, () => fetchEventLikesFromApi(eventId)),
  like: async (eventId: string, options?: EventLikeMutationOptions): Promise<LikeResponse> => {
    let source = "patch-rpc";
    return observeMutation({
      meta: { eventId, target: "event-like" },
      name: "event-like-toggle",
      task: async () => {
        const desiredLiked =
          typeof options?.desiredLiked === "boolean" ? options.desiredLiked : null;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await assertEventInteractionAllowed({
          eventId,
          viewerIdHint: user?.id,
        });

        const verifyDesiredLikeState = async () => {
          if (!user?.id || desiredLiked === null) return null;
          const verified = await readEventLikeState(eventId, user.id);
          return verified?.liked === desiredLiked ? verified : null;
        };

        const rpcResult = await executeEventToggleRpcWithFallback<LikeResponse>({
          baseArgs: { target_event_id: eventId },
          baseName: "toggle_event_like",
          options,
          parseResult: extractEventLikeResponse,
          patchName: "toggle_event_like",
          verifyAfterError: verifyDesiredLikeState,
        });

        if (rpcResult.result) {
          source = rpcResult.source || source;
          let result = rpcResult.result;
          if (user?.id && desiredLiked !== null) {
            const verified = await readEventLikeState(eventId, user.id);
            if (verified?.liked === desiredLiked) {
              result = verified;
            } else {
              const reconciled = await reconcileEventLikeDirect(eventId, user.id, desiredLiked);
              if (reconciled) {
                source = "table-reconcile";
                result = reconciled;
              }
            }
          }
          triggerPushDispatchWakeup("event-like-toggle");
          return result;
        }

        if (user?.id && desiredLiked !== null) {
          const verified = await verifyDesiredLikeState();
          if (verified) {
            source = "table-verified";
            return verified;
          }
          const reconciled = await reconcileEventLikeDirect(eventId, user.id, desiredLiked);
          if (reconciled) {
            source = "table-reconcile";
            triggerPushDispatchWakeup("event-like-toggle");
            return reconciled;
          }
        }

        throw toEventMutationError(rpcResult.error, "Etkinlik begenisi güncellenemedi.");
      },
      toSuccessMeta: (result) => ({ liked: result.liked, source }),
    });
  },
  getAttendees: async (eventId: string): Promise<SearchUserResult[]> =>
    getEventAttendeesList(eventId, () => fetchEventAttendeesFromApi(eventId)),
  attend: async (
    eventId: string,
    options?: EventAttendanceMutationOptions,
  ): Promise<AttendResponse> => {
    let source = "patch-rpc";
    return observeMutation({
      meta: { eventId, target: "event-attend" },
      name: "event-attend-toggle",
      task: async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await assertEventInteractionAllowed({
          eventId,
          viewerIdHint: user?.id,
        });
        if (user) {
          const { data: me } = await supabase
            .from("profiles")
            .select("account_type")
            .eq("user_id", user.id)
            .maybeSingle();
          if (me?.account_type === "club") {
            throw new Error("Kulüp hesaplari etkinliklere katilamaz.");
          }
        }

        const desiredJoined =
          typeof options?.desiredJoined === "boolean" ? options.desiredJoined : null;
        const verifyDesiredAttendanceState = async () => {
          if (!user?.id || desiredJoined === null) return null;
          const verified = await readEventAttendanceState(eventId, user.id);
          return verified?.joined === desiredJoined ? verified : null;
        };

        const rpcResult = await executeEventToggleRpcWithFallback<AttendResponse>({
          baseArgs: { target_event_id: eventId },
          baseName: "toggle_event_attendance",
          options,
          parseResult: extractEventAttendResponse,
          patchName: "toggle_event_attendance",
          verifyAfterError: verifyDesiredAttendanceState,
        });

        if (rpcResult.result) {
          source = rpcResult.source || source;
          let result = rpcResult.result;
          if (user?.id && desiredJoined !== null) {
            const verified = await readEventAttendanceState(eventId, user.id);
            if (verified?.joined === desiredJoined) {
              result = verified;
            } else {
              const reconciled = await reconcileEventAttendanceDirect(
                eventId,
                user.id,
                desiredJoined,
              );
              if (reconciled) {
                source = "table-reconcile";
                result = reconciled;
              }
            }
          }
          triggerPushDispatchWakeup("event-attend-toggle");
          return result;
        }

        if (user?.id && desiredJoined !== null) {
          const verified = await verifyDesiredAttendanceState();
          if (verified) {
            source = "table-verified";
            return verified;
          }
          const reconciled = await reconcileEventAttendanceDirect(eventId, user.id, desiredJoined);
          if (reconciled) {
            source = "table-reconcile";
            triggerPushDispatchWakeup("event-attend-toggle");
            return reconciled;
          }
        }

        throw toEventMutationError(rpcResult.error, "Etkinlik katilimi güncellenemedi.");
      },
      toSuccessMeta: (result) => ({ joined: result.joined, source }),
    });
  },
  deleteEvent: async (eventId: string): Promise<SuccessResponse> =>
    del<SuccessResponse>(`/events/${eventId}`),
  deleteComment: async (eventId: string, commentId: string): Promise<SuccessResponse> =>
    del<SuccessResponse>(`/events/${eventId}/comments/${commentId}`),
};
