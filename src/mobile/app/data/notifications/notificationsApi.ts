import type { NotificationItem, SuccessResponse } from "../contracts/api";
import type { ClientMutationOptions } from "../mutations/clientMutation";
import { supabase } from "../../platform/supabase";
import {
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from "./notificationsApi.mutations";
import {
  fetchNotificationByIdForViewer,
  fetchNotificationsForViewer,
} from "./notificationsApi.reads";

export const NotificationAPI = {
  getAll: async (viewerId?: string): Promise<NotificationItem[]> => {
    const targetViewerId = String(viewerId || "").trim();
    if (targetViewerId) {
      return fetchNotificationsForViewer(targetViewerId);
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    return fetchNotificationsForViewer(user.id);
  },

  getById: async (notificationId: string, viewerId?: string): Promise<NotificationItem | null> => {
    const id = String(notificationId || "").trim();
    if (!id) return null;
    const targetViewerId = String(viewerId || "").trim();
    if (targetViewerId) {
      return fetchNotificationByIdForViewer(targetViewerId, id);
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return fetchNotificationByIdForViewer(user.id, id);
  },

  markAllRead: async (options?: ClientMutationOptions): Promise<SuccessResponse> => {
    return markAllNotificationsReadRequest(options);
  },

  markRead: async (
    notificationId: string,
    options?: ClientMutationOptions,
  ): Promise<SuccessResponse> => {
    return markNotificationReadRequest(notificationId, options);
  },
};
