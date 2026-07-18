import { useMemo } from "react";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import type { RelationshipProjectionItem } from "../../../data/projections/projections.types";
import { useProjectionScreen } from "../../../data/projections/screen/useProjectionScreen";
import { getRelationshipsQueryDef } from "../data";

interface UseRelationshipListParams {
  isBlocked: (username: string) => boolean;
  targetUsername: string;
  type: "followers" | "following";
  viewer: {
    id?: string;
    username?: string;
  };
}

export function useRelationshipList(params: UseRelationshipListParams) {
  const viewerKey = getViewerKey(params.viewer);
  const viewerUsername = String(params.viewer.username || "")
    .trim()
    .toLowerCase();
  const relDef = getRelationshipsQueryDef({
    kind: params.type,
    username: params.targetUsername,
    viewer: { id: params.viewer.id, username: params.viewer.username || "" },
  });
  const projection = useProjectionScreen<RelationshipProjectionItem>({
    ...relDef,
    autoRefreshOnFocus: true,
  });
  const data = useMemo(
    () => (projection.items || []).filter((item) => !params.isBlocked(item.username)),
    [params, projection.items],
  );

  return {
    data,
    listKey: relDef.queryKey,
    projection,
    viewerKey,
    viewerUsername,
  };
}
