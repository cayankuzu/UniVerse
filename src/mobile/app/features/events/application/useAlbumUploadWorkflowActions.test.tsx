import { act, renderHook } from "@testing-library/react-native";
import type { MediaSelection } from "../../../shared/media/mediaPicker";
import { useAlbumUploadDraftState } from "./useAlbumUploadDraftState";
import { useAlbumUploadWorkflowActions } from "./useAlbumUploadWorkflowActions";

function createMediaSelection(index: number, kind: "image" | "video"): MediaSelection {
  const extension = kind === "video" ? "mp4" : "jpg";
  return {
    durationMs: kind === "video" ? 60_000 : null,
    fileName: `album-media-${index}.${extension}`,
    kind,
    mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
    uri: `file:///album-media-${index}.${extension}`,
  };
}

function useWorkflowHarness(remainingTotalSlots: number) {
  const draft = useAlbumUploadDraftState();
  const selectedMediaCounts = {
    imageCount: draft.selectedMediaItems.filter((item) => item.kind === "image").length,
    totalCount: draft.selectedMediaItems.length,
    videoCount: draft.selectedMediaItems.filter((item) => item.kind === "video").length,
  };

  const actions = useAlbumUploadWorkflowActions({
    availableSelectionSlots: remainingTotalSlots,
    canUpload: true,
    draft,
    eventId: "event-1",
    hasSelectedProfileVisibility: true,
    isTempEvent: false,
    queueAlbumUpload: jest.fn().mockResolvedValue("queued"),
    remainingAlbumSlots: 3,
    remainingTotalSlots,
    resetUploadState: jest.fn(),
    selectedMediaCounts,
    setUploadCheckPending: jest.fn(),
    setWarningMessage: jest.fn(),
    showOnClubProfile: false,
    showOnOwnProfile: false,
    uploadMessage: "",
    userId: "user-1",
  });

  return {
    ...actions,
    draft,
  };
}

describe("useAlbumUploadWorkflowActions", () => {
  it("accepts nine videos when total card slots allow it", () => {
    const { result } = renderHook(() => useWorkflowHarness(9));

    act(() => {
      result.current.handleMediaLibrarySelection(
        Array.from({ length: 9 }, (_, index) => createMediaSelection(index + 1, "video")),
      );
    });

    expect(result.current.draft.selectedMediaItems).toHaveLength(9);
    expect(result.current.draft.selectedMediaItems.every((item) => item.kind === "video")).toBe(
      true,
    );
  });

  it("limits accepted media only by remaining total slots", () => {
    const { result } = renderHook(() => useWorkflowHarness(4));

    act(() => {
      result.current.handleMediaLibrarySelection([
        createMediaSelection(1, "video"),
        createMediaSelection(2, "video"),
        createMediaSelection(3, "image"),
        createMediaSelection(4, "video"),
        createMediaSelection(5, "image"),
        createMediaSelection(6, "video"),
      ]);
    });

    expect(result.current.draft.selectedMediaItems.map((item) => item.uri)).toEqual([
      "file:///album-media-1.mp4",
      "file:///album-media-2.mp4",
      "file:///album-media-3.jpg",
      "file:///album-media-4.mp4",
    ]);
  });
});
