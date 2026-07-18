import { act, renderHook } from "@testing-library/react-native";
import { useAlbumUploadDrag } from "./useAlbumUploadDrag";

describe("useAlbumUploadDrag", () => {
  it("initializes, resets, and cleans the drag state without stale transforms", () => {
    const onSelectPhoto = jest.fn();
    const { result, unmount } = renderHook(() =>
      useAlbumUploadDrag({
        onReorderSelectedPhoto: jest.fn(),
        onSelectPhoto,
        selectedPhotoUris: ["one.jpg", "two.jpg"],
        uploadPending: false,
      }),
    );

    act(() => result.current.beginDrag(1, "two.jpg"));
    expect(result.current.draggingPhotoUri).toBe("two.jpg");
    expect(onSelectPhoto).toHaveBeenCalledWith(1);

    act(() => result.current.resetDragState());
    expect(result.current.draggingPhotoUri).toBe("");
    unmount();
  });
});
