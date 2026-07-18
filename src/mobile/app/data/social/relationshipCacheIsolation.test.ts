import { QueryClient } from "@tanstack/react-query";
import { createProjectionScreenState } from "../projections/projectionMerge";
import { projectionKeys } from "../projections/projectionKeys";
import { getViewerRelationshipSnapshotQueryKey } from "./relationshipSnapshot";
import { removeBlockedRelationshipSurfaces } from "./relationshipCacheIsolation";

describe("removeBlockedRelationshipSurfaces", () => {
  it("removes both sides from relationship screens and viewer follow snapshot", () => {
    const queryClient = new QueryClient();
    const viewerId = "viewer-1";
    const viewerUsername = "vieweruser";
    const targetId = "target-1";
    const targetUsername = "targetuser";

    queryClient.setQueryData(
      projectionKeys.relationships(viewerUsername, "followers", viewerId),
      createProjectionScreenState({
        deltaToken: null,
        ids: [targetId, "other-user"],
        nextCursor: null,
        serverTime: null,
      }),
    );
    queryClient.setQueryData(
      projectionKeys.relationships(viewerUsername, "following", viewerId),
      createProjectionScreenState({
        deltaToken: null,
        ids: [targetId, "other-user"],
        nextCursor: null,
        serverTime: null,
      }),
    );
    queryClient.setQueryData(
      projectionKeys.relationships(targetUsername, "followers", viewerId),
      createProjectionScreenState({
        deltaToken: null,
        ids: [viewerId, "other-user"],
        nextCursor: null,
        serverTime: null,
      }),
    );
    queryClient.setQueryData(
      projectionKeys.relationships(targetUsername, "following", viewerId),
      createProjectionScreenState({
        deltaToken: null,
        ids: [viewerId, "other-user"],
        nextCursor: null,
        serverTime: null,
      }),
    );
    queryClient.setQueryData(
      getViewerRelationshipSnapshotQueryKey({
        viewerId,
        viewerUsername,
      }),
      {
        clubPrivacyMap: { [targetUsername]: false },
        following: [{ accountType: "club", isPrivate: false, username: targetUsername }],
        followingClubUsernames: [targetUsername],
        followingStudentUsernames: [],
        followingUsernames: [targetUsername],
        id: viewerId,
        viewerId,
        viewerUsername,
      },
    );

    removeBlockedRelationshipSurfaces({
      queryClient,
      targetAccountType: "club",
      targetUserId: targetId,
      targetUsername,
      viewerCacheKey: viewerId,
      viewerUsername,
    });

    expect(
      (
        queryClient.getQueryData(
          projectionKeys.relationships(viewerUsername, "followers", viewerId),
        ) as { ids: string[] }
      ).ids,
    ).toEqual(["other-user"]);
    expect(
      (
        queryClient.getQueryData(
          projectionKeys.relationships(viewerUsername, "following", viewerId),
        ) as { ids: string[] }
      ).ids,
    ).toEqual(["other-user"]);
    expect(
      (
        queryClient.getQueryData(
          projectionKeys.relationships(targetUsername, "followers", viewerId),
        ) as { ids: string[] }
      ).ids,
    ).toEqual(["other-user"]);
    expect(
      (
        queryClient.getQueryData(
          projectionKeys.relationships(targetUsername, "following", viewerId),
        ) as { ids: string[] }
      ).ids,
    ).toEqual(["other-user"]);
    expect(
      queryClient.getQueryData(
        getViewerRelationshipSnapshotQueryKey({
          viewerId,
          viewerUsername,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        following: [],
        followingClubUsernames: [],
        followingUsernames: [],
      }),
    );
  });
});
