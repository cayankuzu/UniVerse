import { projectionKeys } from "../../../data/projections/projectionKeys";

type FollowState = "none" | "requested" | "following";

export function buildViewProfileFollowActionPlan(params: {
  currentStatus: FollowState;
  profile:
    | {
        accountType?: "club" | "student";
        isPrivate?: boolean;
      }
    | null
    | undefined;
}) {
  const targetStatus: FollowState =
    params.currentStatus === "following" || params.currentStatus === "requested"
      ? "none"
      : params.profile?.accountType === "club" || !params.profile?.isPrivate
        ? "following"
        : "requested";
  const needsConfirm =
    params.currentStatus === "following" &&
    params.profile?.accountType !== "club" &&
    Boolean(params.profile?.isPrivate);

  return {
    confirmation: needsConfirm
      ? {
          cancelLabel: "İptal",
          confirmLabel: "Takibi Bırak",
          destructive: true,
          message: "Bu gizli hesabı takipten çıkmak istiyor musunuz?",
          title: "Takibi Bırak",
        }
      : null,
    targetStatus,
  };
}

export function resolveViewProfileListAccess(params: {
  canViewList: boolean;
  fallbackMessage: string;
  lockedReasonText?: string | null;
}) {
  return {
    allowed: params.canViewList,
    warningMessage: params.canViewList ? null : params.lockedReasonText || params.fallbackMessage,
  };
}

export function resolveViewProfileContentWarning(params: {
  contentLockedMessage?: string | null;
  lockedReasonText?: string | null;
}) {
  return (
    params.lockedReasonText ||
    params.contentLockedMessage ||
    "Bu hesabın içerikleri görüntülenemiyor."
  );
}

export function buildViewProfileBlockRefreshKeys(params: {
  username: string;
  viewerCacheKey: string;
  viewerUsername: string;
}) {
  return [
    projectionKeys.screen("profile-content", params.username),
    projectionKeys.screen("home", params.viewerCacheKey),
    projectionKeys.screen("notifications", params.viewerCacheKey),
    projectionKeys.screen("event-detail"),
    projectionKeys.screen("album-event"),
    projectionKeys.screen("search"),
  ] as const;
}
