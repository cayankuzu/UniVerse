import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { PendingAlbumPhoto } from "../../data";
import { EventAlbumPendingActions } from "./EventAlbumPendingActions";

describe("EventAlbumPendingActions", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it("asks for confirmation before cancelling an uploading album card", () => {
    const onRemove = jest.fn();
    render(
      <EventAlbumPendingActions
        onRemove={onRemove}
        onRetry={() => undefined}
        pending={
          {
            caption: "",
            comments: 0,
            createdAt: "2026-07-06T00:00:00.000Z",
            eventId: "event-1",
            eventTitle: "Event",
            id: "temp-album:1",
            image: "file:///album.jpg",
            images: ["file:///album.jpg"],
            liked: false,
            likes: 0,
            name: "Viewer",
            photoCount: 1,
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
            surfaceVisibility: {
              showOnClubProfile: false,
              showOnOwnProfile: true,
              showOnProfile: true,
            },
            uploadStatus: "pending",
            userId: "viewer-1",
            userImage: "",
            username: "viewer",
          } as PendingAlbumPhoto
        }
      />,
    );

    fireEvent.press(screen.getByText("İptal Et"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Yükleme iptal edilsin mi?",
      "Bu albüm kartının bekleyen yüklemesi iptal edilecek.",
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ onPress?: () => void }>;
    buttons[1]?.onPress?.();

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation before deleting a failed album card", () => {
    const onRemove = jest.fn();
    render(
      <EventAlbumPendingActions
        onRemove={onRemove}
        onRetry={() => undefined}
        pending={
          {
            caption: "",
            comments: 0,
            createdAt: "2026-07-06T00:00:00.000Z",
            eventId: "event-1",
            eventTitle: "Event",
            id: "temp-album:failed",
            image: "file:///album.jpg",
            images: ["file:///album.jpg"],
            liked: false,
            likes: 0,
            name: "Viewer",
            photoCount: 1,
            showOnClubProfile: false,
            showOnOwnProfile: true,
            showOnProfile: true,
            surfaceVisibility: {
              showOnClubProfile: false,
              showOnOwnProfile: true,
              showOnProfile: true,
            },
            uploadError: "upload failed",
            uploadStatus: "failed",
            userId: "viewer-1",
            userImage: "",
            username: "viewer",
          } as PendingAlbumPhoto
        }
      />,
    );

    fireEvent.press(screen.getByText("Sil"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Kart silinsin mi?",
      "Bu başarısız albüm kartı kuyruktan kaldırılacak.",
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ onPress?: () => void }>;
    buttons[1]?.onPress?.();

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
