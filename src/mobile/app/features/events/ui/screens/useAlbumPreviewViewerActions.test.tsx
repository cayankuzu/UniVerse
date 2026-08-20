import { act, renderHook, waitFor } from "@testing-library/react-native";
import { downloadMediaToGallery } from "../../../../shared/media/downloadMediaToGallery";
import { showConfirmAlert, showErrorAlert } from "../../../../shared/utils/alerts";
import { useAlbumPreviewViewerActions } from "./useAlbumPreviewViewerActions";

jest.mock("../../../../shared/media/downloadMediaToGallery", () => ({
  downloadMediaToGallery: jest.fn(),
}));
jest.mock("../../../../shared/utils/alerts", () => ({
  showConfirmAlert: jest.fn(),
  showErrorAlert: jest.fn(),
}));

const mockDownloadMediaToGallery = downloadMediaToGallery as jest.Mock;
const mockShowConfirmAlert = showConfirmAlert as jest.Mock;
const mockShowErrorAlert = showErrorAlert as jest.Mock;

describe("useAlbumPreviewViewerActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns no actions without an active media URI", () => {
    const { result } = renderHook(() =>
      useAlbumPreviewViewerActions({
        activeViewerIndex: 0,
        activeViewerItem: null,
        onCloseViewer: jest.fn(),
        onRemoveSelectedPhoto: jest.fn(),
      }),
    );

    expect(result.current).toEqual([]);
  });

  it("downloads media and reports download failures", async () => {
    mockDownloadMediaToGallery.mockRejectedValue(new Error("İndirme reddedildi"));
    const { result } = renderHook(() =>
      useAlbumPreviewViewerActions({
        activeViewerIndex: 1,
        activeViewerItem: { kind: "video", label: "clip.mp4", uri: "file://clip.mp4" },
        onCloseViewer: jest.fn(),
        onRemoveSelectedPhoto: jest.fn(),
      }),
    );

    act(() => result.current[0]?.onPress());

    await waitFor(() => expect(mockShowErrorAlert).toHaveBeenCalled());
    expect(mockDownloadMediaToGallery).toHaveBeenCalledWith({
      fileName: "clip.mp4",
      kind: "video",
      uri: "file://clip.mp4",
    });
  });

  it("confirms removal and closes the viewer before deleting the selected item", () => {
    const onCloseViewer = jest.fn();
    const onRemoveSelectedPhoto = jest.fn();
    const { result } = renderHook(() =>
      useAlbumPreviewViewerActions({
        activeViewerIndex: 2,
        activeViewerItem: { kind: "image", uri: "file://photo.jpg" },
        onCloseViewer,
        onRemoveSelectedPhoto,
      }),
    );

    act(() => result.current[1]?.onPress());
    const request = mockShowConfirmAlert.mock.calls[0]?.[0];
    act(() => request.onConfirm());

    expect(onCloseViewer).toHaveBeenCalled();
    expect(onRemoveSelectedPhoto).toHaveBeenCalledWith(2);
  });
});
