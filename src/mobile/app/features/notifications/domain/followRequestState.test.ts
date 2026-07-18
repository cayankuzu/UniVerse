import {
  resolveRequestActionDisplayState,
  resolveVisibleFollowRequestStateKey,
} from "./followRequestState";

describe("followRequestState", () => {
  it("prefers processed actions over pending and persisted status", () => {
    expect(
      resolveRequestActionDisplayState({
        pendingAction: "accept",
        processedAction: "reject",
        requestStatus: "accepted",
      }),
    ).toMatchObject({
      acceptSelected: false,
      rejectSelected: true,
      selectedAction: "reject",
      statusLabel: "İşlem: Reddedildi",
    });
  });

  it("falls back to the latest persisted status when there is no local action", () => {
    expect(
      resolveRequestActionDisplayState({
        requestStatus: "accepted",
      }),
    ).toMatchObject({
      acceptSelected: true,
      rejectSelected: false,
      selectedAction: "accept",
      statusLabel: "İşlem: Kabul edildi",
    });
  });

  it("normalizes request keys for inline action state", () => {
    expect(
      resolveVisibleFollowRequestStateKey({
        notificationId: "notification-id",
        requestKey: "Follow:Requester:2026-03-14T00:00:00.000Z",
        username: "Requester",
      }),
    ).toBe("follow:requester:2026-03-14t00:00:00.000z");
  });
});
