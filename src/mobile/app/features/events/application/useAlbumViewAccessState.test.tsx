import { renderHook } from "@testing-library/react-native";

import { useAlbumViewAccessState } from "./useAlbumViewAccessState";

describe("useAlbumViewAccessState", () => {
  it("keeps the album screen open when the viewer still has their own photos", () => {
    const { result } = renderHook(() =>
      useAlbumViewAccessState({
        buildRelationByClub: () => ({}),
        event: {
          canOpenEventAlbum: false,
          canOpenEventDetail: false,
          clubUsername: "blocked-club",
          id: "event-1",
          title: "Blocked event",
        } as any,
        eventQueryError: null,
        hasViewerOwnedPhotos: true,
        userData: {
          id: "viewer-1",
          username: "viewer",
        },
      }),
    );

    expect(result.current.accessMessage).toBeNull();
  });

  it("uses the authoritative event capability for album upload access", () => {
    const { result } = renderHook(() =>
      useAlbumViewAccessState({
        buildRelationByClub: () => ({}),
        event: {
          canOpenEventAlbum: true,
          canOpenEventDetail: true,
          canUploadEventAlbum: false,
          clubUserId: "club-1",
          clubUsername: "club-a",
          id: "event-2",
          joined: true,
          lockedReasonText: "Bu etkinlik sona erdigi icin album yukleme izni su anda kapali.",
          title: "Ended event",
        } as any,
        eventQueryError: null,
        hasViewerOwnedPhotos: false,
        userData: {
          id: "viewer-1",
          username: "viewer",
        },
      }),
    );

    expect(result.current.canUpload).toBe(false);
    expect(result.current.uploadMessage).toContain("album yukleme izni");
  });
});
