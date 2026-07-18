import type { AuthUserData } from "../../../data/contracts/entities";

export type ContentViewer = Pick<
  AuthUserData,
  "id" | "username" | "name" | "clubName" | "profileImage" | "university"
>;
