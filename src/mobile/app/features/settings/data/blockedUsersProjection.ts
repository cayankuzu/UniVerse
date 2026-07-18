import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import type { BlockedUserProjectionItem } from "../../../data/projections/projections.types";
import { getBlockedUsersQueryDef } from "./blockedUsersRepository";

export type { BlockedUserProjectionItem };

export function useBlockedUsersProjectionData(userId: string | undefined, viewerKey: string) {
  const blockedDef = getBlockedUsersQueryDef({ id: userId, username: viewerKey });
  return useProjectionScreen<BlockedUserProjectionItem>({
    ...blockedDef,
    autoRefreshOnFocus: true,
  });
}
