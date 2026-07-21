import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { MediaVideo } from "./MediaVideo";

let mockResolvedUri = "";
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockPlayer = {
  loop: false,
  muted: false,
  pause: mockPause,
  play: mockPlay,
};
const mockUseVideoPlayer = jest.fn(
  (_source: string | null, setup?: (player: typeof mockPlayer) => void) => {
    setup?.(mockPlayer);
    return mockPlayer;
  },
);

jest.mock("expo-video", () => ({
  setVideoCacheSizeAsync: jest.fn().mockResolvedValue(undefined),
  VideoView: () => null,
  useVideoPlayer: (source: string | null, setup?: (player: typeof mockPlayer) => void) =>
    mockUseVideoPlayer(source, setup),
}));

jest.mock("./useResolvedMediaUri", () => ({
  useResolvedMediaUri: jest.fn(() => mockResolvedUri),
}));

jest.mock("./mediaUri", () => ({
  canUseMediaUriDirectly: jest.fn((uri: string) => /^(?:https?|file|content|asset):/i.test(uri)),
  normalizeMediaUriInput: jest.fn((uri: string) => String(uri || "").trim()),
}));

jest.mock("./VideoThumbnailPreview", () => ({
  VideoThumbnailPreview: () => null,
}));

describe("MediaVideo", () => {
  beforeEach(() => {
    mockPlay.mockClear();
    mockPause.mockClear();
    mockResolvedUri = "";
    mockUseVideoPlayer.mockClear();
  });

  it("does not initialize the player with a private object path and autoplays once resolved", async () => {
    const { rerender } = render(<MediaVideo autoPlay uri="albums/private-video.mp4" />);

    expect(mockUseVideoPlayer).toHaveBeenLastCalledWith(null, expect.any(Function));
    expect(mockPlay).not.toHaveBeenCalled();

    mockResolvedUri = "https://cdn.example.com/private-video.mp4?token=signed";
    rerender(<MediaVideo autoPlay uri="albums/private-video.mp4" />);

    await waitFor(() => {
      expect(mockUseVideoPlayer).toHaveBeenLastCalledWith(
        { uri: mockResolvedUri, useCaching: true },
        expect.any(Function),
      );
      expect(mockPlay).toHaveBeenCalledTimes(1);
    });
  });

  it("pauses playback as soon as the media is no longer active", async () => {
    mockResolvedUri = "https://cdn.example.com/video.mp4";
    const { rerender } = render(<MediaVideo active autoPlay uri="video.mp4" />);

    rerender(<MediaVideo active={false} autoPlay uri="video.mp4" />);

    await waitFor(() => expect(mockPause).toHaveBeenCalled());
  });
});
