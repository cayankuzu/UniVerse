import { act, renderHook } from "@testing-library/react-native";

import type { MediaSelection } from "../../../shared/media/mediaPicker";
import { useAlbumUploadDraftState } from "./useAlbumUploadDraftState";

function createSelection(index: number): MediaSelection {
  return {
    kind: "image",
    uri: `file:///album-media-${index}.jpg`,
  };
}

describe("useAlbumUploadDraftState", () => {
  it("keeps existing media when new picks are appended with remaining slot count", () => {
    const { result } = renderHook(() => useAlbumUploadDraftState());

    act(() => {
      result.current.appendSelectedMediaItems(
        Array.from({ length: 6 }, (_, index) => createSelection(index + 1)),
        9,
      );
    });

    act(() => {
      result.current.appendSelectedMediaItems(
        Array.from({ length: 3 }, (_, index) => createSelection(index + 7)),
        3,
      );
    });

    expect(result.current.selectedMediaItems.map((item) => item.uri)).toEqual([
      "file:///album-media-1.jpg",
      "file:///album-media-2.jpg",
      "file:///album-media-3.jpg",
      "file:///album-media-4.jpg",
      "file:///album-media-5.jpg",
      "file:///album-media-6.jpg",
      "file:///album-media-7.jpg",
      "file:///album-media-8.jpg",
      "file:///album-media-9.jpg",
    ]);
    expect(result.current.normalizedSelectedPhotoIndex).toBe(6);
  });
});
