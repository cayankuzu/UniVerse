import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { AuthAPI } from "../../../data/auth";
import { clearUploadQueueStorage, getUploadEntry } from "../../../data/queues/uploadQueue";
import { StorageAPI } from "../../../data/storage/storage";
import { processProfileUpdateQueue, queueProfileUpdate } from "./profileUpdateQueue";

jest.mock("../../../data/auth", () => ({
  AuthAPI: {
    updateProfile: jest.fn(),
  },
}));

jest.mock("../../../data/storage/storage", () => ({
  StorageAPI: {
    uploadFile: jest.fn(),
  },
}));

describe("profileUpdateQueue", () => {
  const previousUserData = {
    bio: "Onceki bio",
    categories: ["Muzik"],
    clubName: "",
    coverImage: "cover-old.jpg",
    department: "CS",
    description: "",
    email: "old@example.com",
    gradeYear: "4",
    id: "viewer-1",
    name: "Old Name",
    profileImage: "avatar-old.jpg",
    university: "Old Uni",
    username: "olduser",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await clearUploadQueueStorage();
  });

  it("processes queued profile updates and clears the queue entry", async () => {
    const queryClient = new QueryClient();
    const updateUserData = jest.fn();
    await queueProfileUpdate({
      ownerId: "viewer-1",
      payload: {
        accountType: "student",
        bio: "Yeni bio",
        categories: ["Sanat"],
        clubName: "",
        coverImageUri: "file:///cover.jpg",
        currentCoverImage: "cover-old.jpg",
        currentProfileImage: "avatar-old.jpg",
        department: "Design",
        description: "",
        email: "new@example.com",
        gradeYear: "3",
        name: "New Name",
        previousUserData,
        previousUsername: "olduser",
        profileImageUri: "file:///avatar.jpg",
        university: "New Uni",
        username: "newuser",
      },
    });
    (StorageAPI.uploadFile as jest.Mock)
      .mockResolvedValueOnce("avatar-new.jpg")
      .mockResolvedValueOnce("cover-new.jpg");
    (AuthAPI.updateProfile as jest.Mock).mockResolvedValue({
      accountType: "student",
      albumsCount: 0,
      bio: "Yeni bio",
      categories: ["Sanat"],
      clubName: "",
      coverImage: "cover-new.jpg",
      department: "Design",
      description: "",
      email: "new@example.com",
      eventsCount: 0,
      followersCount: 0,
      followingCount: 0,
      gradeYear: "3",
      hideEmail: false,
      id: "viewer-1",
      isPrivate: false,
      name: "New Name",
      profileImage: "avatar-new.jpg",
      university: "New Uni",
      username: "newuser",
    });

    await processProfileUpdateQueue({
      ownerId: "viewer-1",
      queryClient,
      updateUserData,
      viewerKey: "viewer-1",
    });

    expect(StorageAPI.uploadFile).toHaveBeenCalledTimes(2);
    expect(AuthAPI.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: "cover-new.jpg",
        email: "new@example.com",
        profileImage: "avatar-new.jpg",
        username: "newuser",
      }),
    );
    expect(updateUserData).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        username: "newuser",
      }),
    );
  });

  it("restores the previous profile snapshot on terminal failure", async () => {
    const queryClient = new QueryClient();
    const updateUserData = jest.fn();
    const queued = await queueProfileUpdate({
      ownerId: "viewer-1",
      payload: {
        accountType: "student",
        bio: "Yeni bio",
        categories: ["Sanat"],
        clubName: "",
        coverImageUri: "",
        currentCoverImage: "cover-old.jpg",
        currentProfileImage: "avatar-old.jpg",
        department: "Design",
        description: "",
        email: "new@example.com",
        gradeYear: "3",
        name: "New Name",
        previousUserData,
        previousUsername: "olduser",
        profileImageUri: "",
        university: "New Uni",
        username: "newuser",
      },
    });
    (AuthAPI.updateProfile as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

    await processProfileUpdateQueue({
      ownerId: "viewer-1",
      queryClient,
      updateUserData,
      viewerKey: "viewer-1",
    });

    expect(updateUserData).toHaveBeenCalledWith(previousUserData);
    await expect(getUploadEntry(queued.id)).resolves.toEqual(
      expect.objectContaining({
        errorMessage: "Unauthorized",
        status: "failed",
      }),
    );
  });
});
