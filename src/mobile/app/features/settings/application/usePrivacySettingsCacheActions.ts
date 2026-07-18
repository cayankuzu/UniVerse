import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyViewerHideEmailCacheUpdate,
  applyViewerPrivacyCacheUpdate,
  refreshViewerPrivacyCaches,
} from "../data";
import { projectionKeys } from "../../../data/projections/projectionKeys";

export function usePrivacySettingsCacheActions(params: { username: string; viewerKey: string }) {
  const { username, viewerKey } = params;
  const queryClient = useQueryClient();
  const overviewKey = useMemo(
    () => projectionKeys.profileOverview(username, viewerKey),
    [username, viewerKey],
  );

  return useMemo(
    () => ({
      applyHideEmailCacheUpdate: (hideEmail: boolean) =>
        applyViewerHideEmailCacheUpdate({
          hideEmail,
          overviewKey,
          queryClient,
        }),
      applyPrivacyCacheUpdate: (isPrivate: boolean) =>
        applyViewerPrivacyCacheUpdate({
          isPrivate,
          overviewKey,
          queryClient,
          username,
          viewerKey,
        }),
      refreshPrivacyCaches: () =>
        refreshViewerPrivacyCaches({
          queryClient,
          username,
          viewerKey,
        }),
    }),
    [overviewKey, queryClient, username, viewerKey],
  );
}
