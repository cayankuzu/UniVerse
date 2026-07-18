import { renderHook } from "@testing-library/react-native";
import { useHomeFeedCollections } from "./useHomeFeedCollections";

describe("useHomeFeedCollections", () => {
  it("removes blocked actors from visible home items immediately", () => {
    const { result } = renderHook(() =>
      useHomeFeedCollections({
        blockedUsers: ["blocked-club", "blocked-student"],
        buildRelationByClub: () => ({}),
        enforceFollowVisibility: false,
        followingClubUsernames: new Set(),
        followingUsernames: new Set(),
        homeProjectionItems: [
          {
            actor: "club",
            event: {
              clubUsername: "blocked-club",
              id: "event-1",
              title: "Blocked event",
            },
            id: "event:event-1",
            kind: "event",
            sortDate: "2026-03-29T10:00:00.000Z",
            source: "following",
          },
          {
            actor: "student",
            album: {
              clubUsername: "blocked-club",
              id: "album-1",
              title: "Own album",
              userId: "user-1",
              username: "viewer",
            },
            id: "album:album-1",
            kind: "album",
            sortDate: "2026-03-29T11:00:00.000Z",
            source: "own",
          },
          {
            actor: "student",
            album: {
              clubUsername: "visible-club",
              id: "album-2",
              title: "Blocked album",
              userId: "user-2",
              username: "blocked-student",
            },
            id: "album:album-2",
            kind: "album",
            sortDate: "2026-03-29T12:00:00.000Z",
            source: "following",
          },
        ] as any,
        homeProjectionIdsLength: 3,
        isFetching: false,
        refreshing: false,
        viewerUsername: "viewer",
      }),
    );

    expect(result.current.effectiveItems).toEqual([
      expect.objectContaining({ id: "album:album-1" }),
    ]);
    expect(result.current.visibleAlbums).toEqual([
      expect.objectContaining({ id: "album-1", username: "viewer" }),
    ]);
    expect(result.current.visibleEvents).toEqual([]);
  });

  it("drops unfollowed student items from home immediately when the relationship snapshot changes", () => {
    const { result } = renderHook(() =>
      useHomeFeedCollections({
        blockedUsers: [],
        buildRelationByClub: () => ({}),
        enforceFollowVisibility: true,
        followingClubUsernames: new Set(["followed-club"]),
        followingUsernames: new Set<string>(),
        homeProjectionItems: [
          {
            actor: "student",
            album: {
              clubUsername: "followed-club",
              id: "album-1",
              title: "Former follow",
              userId: "user-1",
              username: "old-followed-student",
            },
            id: "album:album-1",
            kind: "album",
            sortDate: "2026-03-29T11:00:00.000Z",
            source: "following",
          },
          {
            actor: "club",
            event: {
              clubUsername: "followed-club",
              id: "event-1",
              title: "Still followed club",
            },
            id: "event:event-1",
            kind: "event",
            sortDate: "2026-03-29T10:00:00.000Z",
            source: "following",
          },
        ] as any,
        homeProjectionIdsLength: 2,
        isFetching: false,
        refreshing: false,
        viewerUsername: "viewer",
      }),
    );

    expect(result.current.effectiveItems).toEqual([
      expect.objectContaining({ id: "event:event-1" }),
    ]);
  });

  it("keeps the last visible projection while a fetch temporarily clears rows", () => {
    const { result, rerender } = renderHook(
      (props: {
        homeProjectionIdsLength: number;
        homeProjectionItems: any[];
        isFetching: boolean;
      }) =>
        useHomeFeedCollections({
          blockedUsers: [],
          buildRelationByClub: () => ({}),
          enforceFollowVisibility: false,
          followingClubUsernames: new Set(),
          followingUsernames: new Set(),
          homeProjectionIdsLength: props.homeProjectionIdsLength,
          homeProjectionItems: props.homeProjectionItems as any,
          isFetching: props.isFetching,
          refreshing: false,
          viewerUsername: "viewer",
        }),
      {
        initialProps: {
          homeProjectionIdsLength: 1,
          homeProjectionItems: [
            {
              actor: "club",
              event: {
                clubUsername: "visible-club",
                id: "event-1",
                title: "Visible event",
              },
              id: "event:event-1",
              kind: "event",
              sortDate: "2026-03-29T10:00:00.000Z",
              source: "following",
            },
          ],
          isFetching: false,
        },
      },
    );

    rerender({
      homeProjectionIdsLength: 1,
      homeProjectionItems: [],
      isFetching: true,
    });

    expect(result.current.effectiveItems).toEqual([
      expect.objectContaining({ id: "event:event-1" }),
    ]);
    expect(result.current.visibleEvents).toEqual([expect.objectContaining({ id: "event-1" })]);
  });
});
