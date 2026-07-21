import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { reportAlbum, reportAlbumComment, reportEventComment } from "../data";
import { useAlbumDetailMenuActions } from "./useAlbumDetailMenuActions";
import { useAlbumFeedCardCommentModeration } from "./useAlbumFeedCardCommentModeration";
import { useAlbumFeedCardMenuActions } from "./useAlbumFeedCardMenuActions";
import { useEventModerationActions } from "./useEventModerationActions";

jest.mock("@tanstack/react-query", () => ({ useQueryClient: jest.fn(() => ({})) }));
jest.mock("../../../data/policies/visibility", () => ({
  getAlbumButtonAction: jest.fn(() => ({ action: "none" })),
}));
jest.mock("../../../data/social/blockedVisibility", () => ({
  loadBlockedAlbumEventWarning: jest.fn(async () => null),
}));
jest.mock("../../../platform/logging/logger", () => ({ debugWarn: jest.fn() }));
jest.mock("../../../shared/feedback/AppTransientActivityContext", () => ({
  useAppTransientActivity: jest.fn(() => ({
    showActivity: jest.fn(() => "activity-id"),
    updateActivity: jest.fn(),
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
