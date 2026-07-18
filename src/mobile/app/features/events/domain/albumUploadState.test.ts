import { hasAlbumUploadDraftChanges } from "./albumUploadState";

describe("hasAlbumUploadDraftChanges", () => {
  it("returns false for a pristine draft", () => {
    expect(
      hasAlbumUploadDraftChanges({
        caption: "",
        selectedPhotoUris: [],
        showOnClubProfile: true,
        showOnOwnProfile: true,
        title: "",
      }),
    ).toBe(false);
  });

  it("returns true when media or visibility changed", () => {
    expect(
      hasAlbumUploadDraftChanges({
        caption: "",
        selectedPhotoUris: ["file:///album.jpg"],
        showOnClubProfile: true,
        showOnOwnProfile: true,
        title: "",
      }),
    ).toBe(true);

    expect(
      hasAlbumUploadDraftChanges({
        caption: "",
        selectedPhotoUris: [],
        showOnClubProfile: false,
        showOnOwnProfile: true,
        title: "",
      }),
    ).toBe(true);
  });
});
