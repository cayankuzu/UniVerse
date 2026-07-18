export type RequestAction = "accept" | "reject";
export type RequestStatus = "pending" | "accepted" | "rejected";
export type LockedRequestState = "accepted" | "rejected" | "processing";

export interface VisibleFollowRequest {
  accountType: "student" | "club";
  fromUserId?: string;
  image: string;
  name: string;
  notificationId?: string;
  requestKey?: string;
  requestStatus?: RequestStatus;
  time: string;
  university?: string;
  username: string;
}

type FollowRequestNotification = {
  createdAt?: string;
  detail?: string;
  fromImage?: string;
  fromName?: string;
  fromUserId?: string;
  fromUsername?: string;
  id?: string;
  requestResolvedAt?: string;
  requestStatus?: RequestStatus;
  time?: string;
  type?: string;
};

export function actionToRequestStatus(action: RequestAction): RequestStatus {
  return action === "accept" ? "accepted" : "rejected";
}

export function requestStatusToAction(status?: RequestStatus): RequestAction | null {
  if (status === "accepted") return "accept";
  if (status === "rejected") return "reject";
  return null;
}

export function requestStatusToLabel(status?: RequestStatus) {
  if (status === "accepted") return "İşlem: Kabul edildi";
  if (status === "rejected") return "İşlem: Reddedildi";
  return null;
}

export function requestActionToLabel(action?: RequestAction | null) {
  if (action === "accept") return requestStatusToLabel("accepted");
  if (action === "reject") return requestStatusToLabel("rejected");
  return null;
}

export function resolveRequestActionDisplayState(params: {
  pendingAction?: RequestAction;
  processedAction?: RequestAction;
  requestStatus?: RequestStatus;
}) {
  const selectedAction =
    params.processedAction || params.pendingAction || requestStatusToAction(params.requestStatus);

  return {
    acceptSelected: selectedAction === "accept",
    rejectSelected: selectedAction === "reject",
    selectedAction,
    statusLabel: requestActionToLabel(selectedAction),
  };
}

export function resolveLockedRequestState(params: {
  pendingAction?: RequestAction;
  processedAction?: RequestAction;
  requestStatus?: RequestStatus;
}): LockedRequestState | null {
  const { pendingAction, processedAction, requestStatus } = params;
  if (requestStatus === "accepted" || processedAction === "accept") return "accepted";
  if (requestStatus === "rejected" || processedAction === "reject") return "rejected";
  if (pendingAction) return "processing";
  return null;
}

export function buildRequestLockedMessage(kind: "follow", state: LockedRequestState) {
  const requestLabel = kind === "follow" ? "Takip isteği" : "Takip isteği";
  if (state === "processing") {
    return `${requestLabel} için işlem zaten başlatıldı. Lütfen bekle.`;
  }
  if (state === "accepted") {
    return `${requestLabel} zaten kabul edildi.`;
  }
  return `${requestLabel} zaten reddedildi.`;
}

export function buildVisibleFollowRequests(
  notifications: FollowRequestNotification[],
): VisibleFollowRequest[] {
  const latestRequestByActor = new Map<string, FollowRequestNotification>();

  notifications.forEach((item) => {
    if (String(item.type) !== "follow_request") return;
    const actorKey = buildNotificationActorKey(item);
    const previous = latestRequestByActor.get(actorKey);
    if (!previous) {
      latestRequestByActor.set(actorKey, item);
      return;
    }
    latestRequestByActor.set(
      actorKey,
      compareFollowRequestRecency(item, previous) >= 0 ? item : previous,
    );
  });

  return Array.from(latestRequestByActor.values())
    .sort((left, right) => compareFollowRequestRecency(right, left))
    .map((item) => ({
      accountType: "student",
      fromUserId: item.fromUserId,
      image: item.fromImage || "",
      name: item.fromName || item.fromUsername || "Kullanıcı",
      notificationId: item.id,
      requestKey: buildFollowRequestKey(item),
      requestStatus: item.requestStatus,
      time: item.time || "",
      university: item.detail || "",
      username: item.fromUsername || "",
    }));
}

export function buildPendingFollowRequestSet(requests: VisibleFollowRequest[]) {
  return new Set(
    requests
      .filter((item) => item.requestStatus !== "accepted" && item.requestStatus !== "rejected")
      .map((item) =>
        String(item.username || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
}

export function resolveVisibleFollowRequestStateKey(
  request: Pick<VisibleFollowRequest, "notificationId" | "requestKey" | "username">,
) {
  return String(request.requestKey || request.notificationId || request.username || "")
    .trim()
    .toLowerCase();
}

function buildNotificationActorKey(
  item: Pick<FollowRequestNotification, "fromUserId" | "fromUsername">,
) {
  return (
    String(item.fromUserId || "")
      .trim()
      .toLowerCase() ||
    String(item.fromUsername || "")
      .trim()
      .toLowerCase() ||
    "unknown"
  );
}

function toFollowRequestTimestamp(value: string | undefined) {
  const timestamp = Date.parse(String(value || "").trim());
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareFollowRequestRecency(
  left: Pick<FollowRequestNotification, "createdAt" | "id" | "requestResolvedAt">,
  right: Pick<FollowRequestNotification, "createdAt" | "id" | "requestResolvedAt">,
) {
  const leftTimestamp = Math.max(
    toFollowRequestTimestamp(left.createdAt),
    toFollowRequestTimestamp(left.requestResolvedAt),
  );
  const rightTimestamp = Math.max(
    toFollowRequestTimestamp(right.createdAt),
    toFollowRequestTimestamp(right.requestResolvedAt),
  );
  if (leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

function buildFollowRequestKey(
  item: Pick<FollowRequestNotification, "createdAt" | "fromUserId" | "fromUsername">,
) {
  return `follow:${buildNotificationActorKey(item)}:${
    String(item.createdAt || "")
      .trim()
      .toLowerCase() || "unknown"
  }`;
}
