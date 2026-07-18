import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getProfileSurfaceProjectionKeys } from "../../../data/profile/profileProjectionKeys";
import { projectionKeys } from "../../../data/projections/projectionKeys";
import { replaceProjectionScope } from "../../../data/projections/projectionRefresh";
import { applyBlockedClientIsolation } from "../../../data/social";
import type { BlockedUserProjectionItem } from "../data";
import { removeBlockedUserFromSettingsProjection, reportBlockedUser } from "../data";

export function useBlockedUsersActions(params: {
  blockedData: BlockedUserProjectionItem[];
  onRestoreProjection: () => Promise<unknown>;
  unblockUser: (username: string, options?: { targetUserId?: string | null }) => Promise<void>;
  viewerKey: string;
  viewerUsername: string;
}) {
  const { blockedData, onRestoreProjection, unblockUser, viewerKey, viewerUsername } = params;
  const queryClient = useQueryClient();

  const handleUnblock = async (username: string) => {
    const blockedEntry = blockedData.find((item) => item.username === username);
    const blockedId = String(blockedEntry?.userId || username).trim();
    removeBlockedUserFromSettingsProjection({
      blockedId,
      queryClient,
      viewerKey,
    });
    try {
      await unblockUser(username, { targetUserId: blockedId });
      await applyBlockedClientIsolation({
        isBlocked: false,
        queryClient,
        targetAccountType: blockedEntry?.accountType,
        targetUserId: blockedId,
        targetUsername: username,
        viewerCacheKey: viewerKey,
        viewerUsername,
      });
      const resetKeys = [
        ...getProfileSurfaceProjectionKeys(username, viewerKey),
        projectionKeys.screen("home", viewerKey),
        projectionKeys.screen("notifications", viewerKey),
        projectionKeys.screen("event-detail"),
        projectionKeys.screen("album-event"),
        projectionKeys.screen("search"),
      ];
      resetKeys.forEach((key) => replaceProjectionScope(queryClient, key));
      return true;
    } catch (error) {
      await onRestoreProjection();
      Alert.alert(
        "Hata",
        String((error as { message?: string } | null)?.message || "Engel kaldırılamadı."),
      );
      return false;
    }
  };

  const handleReport = async (user: BlockedUserProjectionItem) => {
    await reportBlockedUser(user);
  };

  return {
    handleReport,
    handleUnblock,
  };
}
