import { StorageAPI } from "../../../data/storage/storage";
import { uploadProfileMedia } from "./profileUpdateCache.media";

jest.mock("../../../data/storage/storage", () => ({
  StorageAPI: {
    uploadFile: jest.fn(),
  },
}));

describe("uploadProfileMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads changed profile and cover images concurrently", async () => {
    const resolvers = new Map<string, (value: string) => void>();
    (StorageAPI.uploadFile as jest.Mock).mockImplementation(
      (file: { uri: string }) =>
        new Promise<string>((resolve) => {
          resolvers.set(file.uri, resolve);
        }),
    );

    const upload = uploadProfileMedia({
      coverImageUri: "file://cover-new.jpg",
      currentCoverImage: "cover-old.jpg",
      currentProfileImage: "profile-old.jpg",
      profileImageUri: "file://profile-new.jpg",
    });

    expect(StorageAPI.uploadFile).toHaveBeenCalledTimes(2);
    resolvers.get("file://profile-new.jpg")?.("profile-new.jpg");
    resolvers.get("file://cover-new.jpg")?.("cover-new.jpg");

    await expect(upload).resolves.toEqual({
      uploadedCoverImage: "cover-new.jpg",
      uploadedProfileImage: "profile-new.jpg",
    });
  });

  it("keeps each previous image independently when its upload fails", async () => {
    (StorageAPI.uploadFile as jest.Mock).mockImplementation((file: { uri: string }) =>
      file.uri.includes("profile")
        ? Promise.reject(new Error("profile failed"))
        : Promise.resolve("cover-new.jpg"),
    );

    await expect(
      uploadProfileMedia({
        coverImageUri: "file://cover-new.jpg",
        currentCoverImage: "cover-old.jpg",
        currentProfileImage: "profile-old.jpg",
        profileImageUri: "file://profile-new.jpg",
      }),
    ).resolves.toEqual({
      uploadedCoverImage: "cover-new.jpg",
      uploadedProfileImage: "profile-old.jpg",
    });
  });
});
