import type { QueryKey } from "@tanstack/react-query";

export type FollowState = "none" | "requested" | "following";
export type TargetAccountType = "club" | "student";

export type ProfileRelationshipPatchTarget = {
  id: string;
  listKey: QueryKey;
  removeOnNone?: boolean;
};
