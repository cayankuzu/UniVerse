import { renderHook } from "@testing-library/react-native";
import type { AlbumPhotoWithMeta } from "../../../data/contracts/content";
import { useStableProfileAlbums } from "./useStableProfileAlbums";

describe("useStableProfileAlbums", () => {
  it("updates owner presentation fields when the same album receives fresh profile data", () => {
    const initialAlbums: AlbumPhotoWithMeta[] = [
      {
        comments: 0,
        createdAt: "2026-03-19T10:00:00.000Z",
        eventId: "event-1",
        eventTitle: "Etkinlik",
        id: "album-1",
        image: "albums/cover.jpg",
        liked: false,
        likes: 0,
        name: "Eski Ad",
        userId: "user-1",
        userImage: "profiles/old.jpg",
        userUniversity: "Eski Üniversite",
        username: "cyn",
      },
    ];
    const { result, rerender } = renderHook<AlbumPhotoWithMeta[], { albums: AlbumPhotoWithMeta[] }>(
      ({ albums }) => useStableProfileAlbums(albums, false),
      {
        initialProps: { albums: initialAlbums },
      },
    );

    rerender({
      albums: [
        {
          ...initialAlbums[0],
          name: "Güncel Ad",
          userImage: "profiles/current.jpg",
          userUniversity: "Güncel Üniversite",
        },
      ],
    });

    expect(result.current).toEqual([
      expect.objectContaining({
        name: "Güncel Ad",
        userImage: "profiles/current.jpg",
        userUniversity: "Güncel Üniversite",
      }),
    ]);
  });

  it("keeps the previous album cards while a temporary empty state is preserved", () => {
    const initialAlbums: AlbumPhotoWithMeta[] = [
      {
        comments: 0,
        createdAt: "2026-03-19T10:00:00.000Z",
        eventId: "event-1",
        eventTitle: "Etkinlik",
        id: "album-1",
        image: "albums/cover.jpg",
        liked: false,
        likes: 0,
        name: "Cyn User",
        userId: "user-1",
        userImage: "profiles/current.jpg",
        userUniversity: "Güncel Üniversite",
        username: "cyn",
      },
    ];
    const { result, rerender } = renderHook<
      AlbumPhotoWithMeta[],
      { albums: AlbumPhotoWithMeta[]; preserveWhenEmpty: boolean }
    >(({ albums, preserveWhenEmpty }) => useStableProfileAlbums(albums, preserveWhenEmpty), {
      initialProps: {
        albums: initialAlbums,
        preserveWhenEmpty: true,
      },
    });

    rerender({
      albums: [],
      preserveWhenEmpty: true,
    });

    expect(result.current).toEqual([
      expect.objectContaining({
        id: "album-1",
        image: "albums/cover.jpg",
        name: "Cyn User",
        userImage: "profiles/current.jpg",
        userUniversity: "Güncel Üniversite",
        username: "cyn",
      }),
    ]);
  });
});
