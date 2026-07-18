import {
  AlbumAPI,
  EventAPI,
  getFollowingProfiles,
  setupHomeProjectionApiTestMocks,
} from "./homeProjectionApi.test.helpers";
import { getHomeProfileSurfaceSupplement } from "./homeProjectionProfileSurface";

describe("getHomeProfileSurfaceSupplement", () => {
  beforeEach(() => {
    setupHomeProjectionApiTestMocks();
  });

  it("loads deferred profile-surface items outside the initial home fetch", async () => {
    (getFollowingProfiles as jest.Mock).mockResolvedValue([
      {
        accountType: "student",
        username: "followed-student",
      },
    ]);
    (AlbumAPI.getPhotos as jest.Mock).mockImplementation(async (username: string) => {
      if (username === "viewer") {
        return [
          {
            clubUsername: "club-a",
            createdAt: "2026-03-18T10:00:00.000Z",
            eventId: "event-viewer",
            id: "album-viewer",
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "viewer",
          },
        ];
      }
      if (username === "followed-student") {
        return [
          {
            clubUsername: "club-b",
            createdAt: "2026-03-18T09:00:00.000Z",
            eventId: "event-followed-student",
            id: "album-followed-student",
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "followed-student",
          },
        ];
      }
      return [];
    });
    const result = await getHomeProfileSurfaceSupplement({
      blockedUsernames: [],
      entityFilter: "all",
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "student",
      viewerUsername: "viewer",
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "album:album-viewer",
      "album:album-followed-student",
    ]);
    expect(EventAPI.getHomeFeed).not.toHaveBeenCalled();
    expect(AlbumAPI.getVisibleByEventIds).not.toHaveBeenCalled();
    expect(EventAPI.getProfileEvents).not.toHaveBeenCalled();
    expect(AlbumAPI.getPhotos).toHaveBeenCalledWith("viewer");
    expect(AlbumAPI.getPhotos).toHaveBeenCalledWith("followed-student");
  });

  it("respects seeded follow profiles so an optimistic unfollow does not rehydrate stale items", async () => {
    (getFollowingProfiles as jest.Mock).mockResolvedValue([
      {
        accountType: "student",
        username: "stale-followed-student",
      },
    ]);
    (AlbumAPI.getPhotos as jest.Mock).mockImplementation(async (username: string) => {
      if (username === "viewer") {
        return [
          {
            clubUsername: "club-a",
            createdAt: "2026-03-18T10:00:00.000Z",
            eventId: "event-viewer",
            id: "album-viewer",
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "viewer",
          },
        ];
      }
      if (username === "stale-followed-student") {
        return [
          {
            clubUsername: "club-b",
            createdAt: "2026-03-18T09:00:00.000Z",
            eventId: "event-stale-follow",
            id: "album-stale-follow",
            showOnOwnProfile: true,
            showOnProfile: true,
            username: "stale-followed-student",
          },
        ];
      }
      return [];
    });

    const result = await getHomeProfileSurfaceSupplement({
      blockedUsernames: [],
      entityFilter: "all",
      seedProfiles: [],
      sortOption: "newest",
      sourceFilter: "all",
      typeFilter: "all",
      viewerAccountType: "student",
      viewerUsername: "viewer",
    });

    expect(result.items.map((item) => item.id)).toEqual(["album:album-viewer"]);
    expect(getFollowingProfiles).not.toHaveBeenCalled();
    expect(AlbumAPI.getPhotos).toHaveBeenCalledWith("viewer");
    expect(AlbumAPI.getPhotos).not.toHaveBeenCalledWith("stale-followed-student");
  });
});
