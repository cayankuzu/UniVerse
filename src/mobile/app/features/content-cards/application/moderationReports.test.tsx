import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { getAlbumButtonAction } from "../../../data/policies/visibility";
import { loadBlockedAlbumEventWarning } from "../../../data/social/blockedVisibility";
import {
  deleteAlbumComment,
  deleteAlbumPhoto,
  deleteEventComment,
  refreshAlbumMutationScopes,
  removeAlbumMutationCaches,
  reportAlbum,
  reportAlbumComment,
  reportEventComment,
} from "../data";
import { useAlbumDetailMenuActions } from "./useAlbumDetailMenuActions";
import { useAlbumFeedCardCommentModeration } from "./useAlbumFeedCardCommentModeration";
import { useAlbumFeedCardMenuActions } from "./useAlbumFeedCardMenuActions";
import { useEventModerationActions } from "./useEventModerationActions";

jest.mock("@tanstack/react-query", () => ({ useQueryClient: jest.fn(() => ({})) }));
const mockShowActivity = jest.fn(() => "activity-id");
const mockUpdateActivity = jest.fn();

jest.mock("../../../data/policies/visibility", () => ({
  getAlbumButtonAction: jest.fn(() => ({ action: "none" })),
}));
jest.mock("../../../data/social/blockedVisibility", () => ({
  loadBlockedAlbumEventWarning: jest.fn(async () => null),
}));
jest.mock("../../../platform/logging/logger", () => ({ debugWarn: jest.fn() }));
jest.mock("../../../shared/feedback/AppTransientActivityContext", () => ({
  useAppTransientActivity: jest.fn(() => ({
    showActivity: mockShowActivity,
    updateActivity: mockUpdateActivity,
  })),
}));
jest.mock("../data", () => ({
  deleteAlbumComment: jest.fn(),
  deleteAlbumPhoto: jest.fn(),
  deleteEvent: jest.fn(),
  deleteEventComment: jest.fn(),
  refreshAlbumMutationScopes: jest.fn(),
  removeAlbumMutationCaches: jest.fn(),
  removeEventMutationCaches: jest.fn(),
  reportAlbum: jest.fn(),
  reportAlbumComment: jest.fn(),
  reportEvent: jest.fn(),
  reportEventComment: jest.fn(),
}));

const mockReportAlbum = reportAlbum as jest.Mock;
const mockReportAlbumComment = reportAlbumComment as jest.Mock;
const mockReportEventComment = reportEventComment as jest.Mock;
const mockDeleteAlbumComment = deleteAlbumComment as jest.Mock;
const mockDeleteAlbumPhoto = deleteAlbumPhoto as jest.Mock;
const mockDeleteEventComment = deleteEventComment as jest.Mock;
const mockGetAlbumButtonAction = getAlbumButtonAction as jest.Mock;
const mockLoadBlockedAlbumEventWarning = loadBlockedAlbumEventWarning as jest.Mock;
const mockRefreshAlbumMutationScopes = refreshAlbumMutationScopes as jest.Mock;
const mockRemoveAlbumMutationCaches = removeAlbumMutationCaches as jest.Mock;
let alertSpy: jest.SpyInstance;

async function confirmLatestAlert() {
  const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1]?.[2] || [];
  await act(async () => {
    buttons[1]?.onPress?.();
    await Promise.resolve();
  });
}

const photo = {
  clubUserId: "club-id",
  eventId: "event-id",
  id: "photo-id",
  userId: "owner-id",
  username: "owner",
} as never;

describe("album report actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it.each([
    ["detail", useAlbumDetailMenuActions],
    ["feed", useAlbumFeedCardMenuActions],
  ] as const)("reports an album successfully from the %s menu", async (_name, useMenuHook) => {
    const onShowWarning = jest.fn();
    mockReportAlbum.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMenuHook({
        context: "feed",
        currentUsername: "viewer",
        onOpenClub: jest.fn(),
        onOpenEvent: jest.fn(),
        onShowWarning,
        photo,
        viewerUserId: "viewer-id",
      }),
    );

    act(() => result.current.menuActions[0]?.onPress());
    await confirmLatestAlert();

    await waitFor(() =>
      expect(mockReportAlbum).toHaveBeenCalledWith({
        photoId: "photo-id",
        username: "owner",
      }),
    );
    expect(onShowWarning).toHaveBeenCalled();
  });

  it.each([
    ["detail", useAlbumDetailMenuActions],
    ["feed", useAlbumFeedCardMenuActions],
  ] as const)("surfaces an album report failure from the %s menu", async (_name, useMenuHook) => {
    const onShowWarning = jest.fn();
    mockReportAlbum.mockRejectedValue(new Error("failed"));
    const { result } = renderHook(() =>
      useMenuHook({
        context: "feed",
        currentUsername: "viewer",
        onOpenClub: jest.fn(),
        onOpenEvent: jest.fn(),
        onShowWarning,
        photo,
        viewerUserId: "viewer-id",
      }),
    );

    act(() => result.current.menuActions[0]?.onPress());
    await confirmLatestAlert();

    await waitFor(() => expect(onShowWarning).toHaveBeenCalled());
  });
});

describe("comment report actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it.each(["success", "failure"])("handles an album-comment report %s", async (outcome) => {
    const onShowWarning = jest.fn();
    mockReportAlbumComment.mockImplementation(() =>
      outcome === "success" ? Promise.resolve() : Promise.reject(new Error("failed")),
    );
    const { result } = renderHook(() =>
      useAlbumFeedCardCommentModeration({
        comments: [],
        deleteBusy: false,
        invalidateAlbumCaches: jest.fn(),
        onShowWarning,
        patchCommentCount: jest.fn(),
        photoId: "photo-id",
        setComments: jest.fn(),
        setDeleteBusy: jest.fn(),
        userData: { id: "viewer-id" } as never,
      }),
    );

    act(() =>
      result.current.handleReportComment({ id: "comment-id", username: "author" } as never),
    );
    await confirmLatestAlert();

    await waitFor(() => expect(onShowWarning).toHaveBeenCalled());
  });

  it.each(["success", "failure"])("handles an event-comment report %s", async (outcome) => {
    const onShowWarning = jest.fn();
    mockReportEventComment.mockImplementation(() =>
      outcome === "success" ? Promise.resolve() : Promise.reject(new Error("failed")),
    );
    const { result } = renderHook(() =>
      useEventModerationActions({
        canDeleteEvent: false,
        comments: [],
        event: { clubUserId: "club-id", id: "event-id" } as never,
        interactive: true,
        invalidateEventCaches: jest.fn(),
        onShowWarning,
        patchEventCaches: jest.fn(),
        queryClient: {} as never,
        setComments: jest.fn(),
        userId: "viewer-id",
      }),
    );

    act(() =>
      result.current.handleReportComment({ id: "comment-id", username: "author" } as never),
    );
    await confirmLatestAlert();

    await waitFor(() => expect(onShowWarning).toHaveBeenCalled());
  });
});

describe("moderation deletion and album navigation actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAlbumButtonAction.mockReturnValue({ action: "none" });
    mockLoadBlockedAlbumEventWarning.mockResolvedValue(null);
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it.each(["success", "failure"])(
    "optimistically deletes an album comment on %s",
    async (outcome) => {
      const comments = [
        { id: "comment-id", parentId: null, userId: "viewer-id", username: "viewer" },
        { id: "reply-id", parentId: "comment-id", userId: "other-id", username: "other" },
      ] as never;
      const invalidateAlbumCaches = jest.fn();
      const onShowWarning = jest.fn();
      const patchCommentCount = jest.fn();
      const setComments = jest.fn();
      const setDeleteBusy = jest.fn();
      mockDeleteAlbumComment.mockImplementation(() =>
        outcome === "success" ? Promise.resolve() : Promise.reject(new Error("delete failed")),
      );
      const { result } = renderHook(() =>
        useAlbumFeedCardCommentModeration({
          comments,
          deleteBusy: false,
          invalidateAlbumCaches,
          onShowWarning,
          patchCommentCount,
          photoId: "photo-id",
          setComments,
          setDeleteBusy,
          userData: { id: "viewer-id" } as never,
        }),
      );

      act(() => result.current.handleDeleteComment(comments[0]));
      await confirmLatestAlert();

      expect(mockDeleteAlbumComment).toHaveBeenCalledWith("photo-id", "comment-id");
      expect(setDeleteBusy).toHaveBeenNthCalledWith(1, true);
      expect(setDeleteBusy).toHaveBeenLastCalledWith(false);
      if (outcome === "success") {
        expect(invalidateAlbumCaches).toHaveBeenCalled();
        expect(setComments).toHaveBeenCalledWith([]);
      } else {
        expect(setComments).toHaveBeenLastCalledWith(comments);
        expect(patchCommentCount).toHaveBeenLastCalledWith(2);
      }
      expect(onShowWarning).toHaveBeenCalled();
    },
  );

  it.each(["success", "failure"])("deletes an owned album card on %s", async (outcome) => {
    mockDeleteAlbumPhoto.mockImplementation(() =>
      outcome === "success" ? Promise.resolve() : Promise.reject(new Error("delete failed")),
    );
    const { result } = renderHook(() =>
      useAlbumFeedCardMenuActions({
        context: "feed",
        currentUsername: "owner",
        onOpenClub: jest.fn(),
        onOpenEvent: jest.fn(),
        photo,
        viewerUserId: "owner-id",
      }),
    );

    act(() => result.current.menuActions[0]?.onPress());
    await confirmLatestAlert();

    expect(mockShowActivity).toHaveBeenCalled();
    expect(mockDeleteAlbumPhoto).toHaveBeenCalledWith("photo-id");
    if (outcome === "success") {
      expect(mockRemoveAlbumMutationCaches).toHaveBeenCalled();
      expect(mockRefreshAlbumMutationScopes).toHaveBeenCalled();
      expect(mockUpdateActivity).toHaveBeenCalledWith(
        "activity-id",
        expect.objectContaining({ tone: "success" }),
      );
    } else {
      expect(mockUpdateActivity).toHaveBeenCalledWith(
        "activity-id",
        expect.objectContaining({ tone: "error" }),
      );
    }
  });

  it("handles blocked, available, and missing event navigation targets", async () => {
    const onOpenEvent = jest.fn();
    const onShowWarning = jest.fn();
    mockGetAlbumButtonAction.mockReturnValue({ action: "view_event", message: "Açılamıyor" });
    mockLoadBlockedAlbumEventWarning.mockResolvedValueOnce("Engellendi").mockResolvedValue(null);
    const { result } = renderHook(() =>
      useAlbumFeedCardMenuActions({
        context: "feed",
        currentUsername: "viewer",
        onOpenClub: jest.fn(),
        onOpenEvent,
        onShowWarning,
        photo,
        viewerUserId: "viewer-id",
      }),
    );

    act(() => result.current.handleActionPress());
    await waitFor(() => expect(onShowWarning).toHaveBeenCalledWith("Engellendi"));

    act(() => result.current.handleActionPress());
    await waitFor(() => expect(onOpenEvent).toHaveBeenCalledWith("event-id"));

    const missingEvent = renderHook(() =>
      useAlbumFeedCardMenuActions({
        context: "feed",
        currentUsername: "viewer",
        onOpenClub: jest.fn(),
        onOpenEvent,
        onShowWarning,
        photo: {
          clubUserId: "club-id",
          eventId: "",
          id: "photo-id",
          userId: "owner-id",
          username: "owner",
        } as never,
        viewerUserId: "viewer-id",
      }),
    );
    act(() => missingEvent.result.current.handleActionPress());
    await waitFor(() => expect(onShowWarning).toHaveBeenCalledWith("Açılamıyor"));
  });

  it("opens a club action and surfaces its informational message", () => {
    const onOpenClub = jest.fn();
    const onShowWarning = jest.fn();
    mockGetAlbumButtonAction.mockReturnValue({ action: "view_club", message: "Kulübe git" });
    const { result } = renderHook(() =>
      useAlbumFeedCardMenuActions({
        context: "feed",
        currentUsername: "viewer",
        onOpenClub,
        onOpenEvent: jest.fn(),
        onShowWarning,
        photo: {
          clubUserId: "club-id",
          clubUsername: "club",
          eventId: "event-id",
          id: "photo-id",
          userId: "owner-id",
          username: "owner",
        } as never,
        viewerUserId: "viewer-id",
      }),
    );

    act(() => result.current.handleActionPress());
    expect(onShowWarning).toHaveBeenCalledWith("Kulübe git");
    expect(onOpenClub).toHaveBeenCalledWith("club");
  });

  it.each(["success", "failure"])(
    "optimistically deletes an event comment on %s",
    async (outcome) => {
      const comments = [
        { id: "comment-id", parentId: null, userId: "viewer-id", username: "viewer" },
        { id: "reply-id", parentId: "comment-id", userId: "other-id", username: "other" },
      ] as never;
      const invalidateEventCaches = jest.fn();
      const onShowWarning = jest.fn();
      const patchEventCaches = jest.fn();
      const setComments = jest.fn();
      mockDeleteEventComment.mockImplementation(() =>
        outcome === "success" ? Promise.resolve() : Promise.reject(new Error("delete failed")),
      );
      const { result } = renderHook(() =>
        useEventModerationActions({
          canDeleteEvent: false,
          comments,
          event: { clubUserId: "club-id", id: "event-id" } as never,
          interactive: true,
          invalidateEventCaches,
          onShowWarning,
          patchEventCaches,
          queryClient: {} as never,
          setComments,
          userId: "viewer-id",
        }),
      );

      act(() => result.current.handleDeleteComment(comments[0]));
      await confirmLatestAlert();

      expect(mockDeleteEventComment).toHaveBeenCalledWith("event-id", "comment-id");
      expect(patchEventCaches).toHaveBeenNthCalledWith(1, { comments: 0 });
      if (outcome === "success") {
        expect(invalidateEventCaches).toHaveBeenCalled();
        expect(setComments).toHaveBeenCalledWith([]);
      } else {
        expect(setComments).toHaveBeenLastCalledWith(comments);
        expect(patchEventCaches).toHaveBeenLastCalledWith({ comments: 2 });
      }
      expect(onShowWarning).toHaveBeenCalled();
    },
  );
});
