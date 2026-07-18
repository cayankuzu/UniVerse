import {
  canViewAlbum,
  getAlbumButtonAction,
  type RelationSnapshot,
} from "../../../data/policies/visibility";
import { normalize } from "../domain/searchHelpers";

type SearchAlbumLike = {
  clubUsername?: string;
  showOnClubProfile?: boolean;
  showOnProfile?: boolean;
  username?: string;
};

export function resolveSearchAlbumOpenDecision(params: {
  currentUsername?: string | null;
  item: SearchAlbumLike;
  relationByClub: Record<string, RelationSnapshot>;
}) {
  const relations = params.relationByClub[normalize(params.item.clubUsername || "")];
  const access = canViewAlbum(params.currentUsername || "", params.item, "search", relations);
  if (!access.canView) {
    return {
      kind: "warning" as const,
      message: access.reason || "Bu albüm sadece takipçilere açık.",
    };
  }
  const action = getAlbumButtonAction(
    params.currentUsername || "",
    params.item,
    relations,
    "search",
  );
  return action.action === "disabled"
    ? {
        kind: "warning" as const,
        message: action.message || "Bu albüm sadece takipçilere açık.",
      }
    : { kind: "viewer" as const };
}
