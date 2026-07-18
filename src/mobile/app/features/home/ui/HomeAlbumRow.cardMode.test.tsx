import React from "react";
import { render } from "@testing-library/react-native";
import { HomeAlbumRow } from "./HomeAlbumRow";

const mockAlbumFeedCard = jest.fn();

jest.mock("../../../features/content-cards/public/cards", () => ({
  AlbumFeedCard: (props: unknown) => {
    mockAlbumFeedCard(props);
    return null;
  },
}));

describe("HomeAlbumRow card mode", () => {
  beforeEach(() => {
    mockAlbumFeedCard.mockClear();
  });

  it("uses the interactive album feed card path instead of deferred modal actions", () => {
    render(
      <HomeAlbumRow
        currentUsername="viewer"
        isTourTarget={false}
        item={
          {
            album: {
              createdAt: "2026-03-31T12:00:00.000Z",
              id: "album-1",
              image: "https://example.com/album-1.jpg",
              images: ["https://example.com/album-1.jpg", "https://example.com/album-2.jpg"],
              photoCount: 2,
              showOnClubProfile: true,
              showOnOwnProfile: true,
              showOnProfile: true,
              username: "viewer",
            },
            firstFoldVariant: "thumbnail",
            homePresentation: {
              avatarInitials: "VW",
              photoCount: 2,
              universityLabel: "Uni",
              visibility: { text: "Kendim ve Kulüp", type: "club" },
            },
            id: "album:album-1",
            kind: "album",
          } as any
        }
        mediaReady
        onOpenClub={() => undefined}
        onOpenEvent={() => undefined}
        onOpenProfile={() => undefined}
        onShowWarning={() => undefined}
        viewer={{ id: "viewer-1", username: "viewer" } as any}
      />,
    );

    const renderedProps = mockAlbumFeedCard.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(renderedProps).toMatchObject({
      context: "feed",
    });
    expect(renderedProps).not.toHaveProperty("deferModalActions");
  });
});
