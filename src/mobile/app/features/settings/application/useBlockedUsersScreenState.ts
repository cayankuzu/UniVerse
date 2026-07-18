import { useMemo } from "react";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { type BlockedUserProjectionItem, useBlockedUsersProjectionData } from "../data";
import { useBlockedUsersActions } from "./useBlockedUsersActions";

interface UseBlockedUsersScreenStateParams {
  blockedUsernames?: string[];
  goBack: () => void;
  openProfile: (username: string) => void;
  unblockUser: (username: string, options?: { targetUserId?: string | null }) => Promise<void>;
  userData: {
    id?: string;
    username?: string;
  };
}

export function useBlockedUsersScreenState(params: UseBlockedUsersScreenStateParams) {
  const viewerKey = getViewerKey(params.userData);
  const blockedProjection = useBlockedUsersProjectionData(
    String(params.userData.id || ""),
    viewerKey,
  );
  const fallbackBlockedData = useMemo(
    () =>
      Array.from(
        new Set(
          (params.blockedUsernames || [])
            .map((item) =>
              String(item || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        ),
      ).map((username) => ({
        id: username,
        image: "",
        isPrivate: false,
        name: username,
        university: "",
        username,
      })) as BlockedUserProjectionItem[],
    [params.blockedUsernames],
  );
  const blockedData = useMemo(() => {
    const projectionItems = (
      Array.isArray(blockedProjection.items) ? blockedProjection.items : []
    ) as BlockedUserProjectionItem[];
    return projectionItems.length > 0 ? projectionItems : fallbackBlockedData;
  }, [blockedProjection.items, fallbackBlockedData]);
  const { handleReport, handleUnblock } = useBlockedUsersActions({
    blockedData,
    onRestoreProjection: () => blockedProjection.syncProjection("replace"),
    unblockUser: params.unblockUser,
    viewerKey,
    viewerUsername: String(params.userData.username || ""),
  });

  return {
    blockedData,
    blockedProjection,
    handleBack: params.goBack,
    handleReport,
    handleUnblock,
    openProfile: params.openProfile,
    shouldShowInitialSkeleton:
      blockedProjection.shouldShowInitialSkeleton && fallbackBlockedData.length === 0,
  };
}
