import React from "react";
import { render, waitFor } from "@testing-library/react-native";

const mockResolveVideoThumbnail = jest.fn();
const expoImageProps: Array<Record<string, unknown>> = [];

jest.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) => {
    expoImageProps.push(props);
    return null;
  },
}));

jest.mock("./mediaUri", () => ({
  canUseMediaUriDirectly: jest.fn(() => true),
  getCachedResolvedMediaUri: jest.fn(() => ""),
  getMediaUriCacheKey: jest.fn((uri: string) => uri),
  normalizeMediaUriInput: jest.fn((value: string | null | undefined) => String(value || "").trim()),
  resolveMediaUri: jest.fn(async (value: string) => value),
}));

jest.mock("../utils/scheduleAfterInteractions", () => ({
  scheduleAfterInteractions: jest.fn((task: () => void) => {
    task();
    return { cancel: jest.fn() };
  }),
}));

jest.mock("./videoThumbnailCache", () => ({
  getCachedVideoThumbnail: jest.fn(() => null),
  resolveVideoThumbnail: jest.fn((uri: string, options?: unknown) =>
    mockResolveVideoThumbnail(uri, options),
  ),
}));

jest.mock("./mediaVideoUtils", () => ({
  isImageMediaUri: jest.fn((uri: string) => /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(uri)),
}));

const { VideoThumbnailPreview, resolveVideoThumbnailFromCandidates } =
  require("./VideoThumbnailPreview") as typeof import("./VideoThumbnailPreview");

describe("VideoThumbnailPreview", () => {
  beforeEach(() => {
    mockResolveVideoThumbnail.mockReset();
    expoImageProps.length = 0;
  });

  it("falls back to the next candidate uri when the first thumbnail source fails", async () => {
    const thumbnail = { uri: "file:///thumb.jpg" } as never;
    mockResolveVideoThumbnail.mockImplementation(async (uri: string) => {
      if (uri === "content://video-primary") {
        return null;
      }
      if (uri === "file:///video-secondary.mp4") {
        return thumbnail;
      }
      return null;
    });

    await expect(
      resolveVideoThumbnailFromCandidates(
        ["content://video-primary", "file:///video-secondary.mp4"],
        "eager",
        () => false,
      ),
    ).resolves.toBe(thumbnail);

    expect(mockResolveVideoThumbnail).toHaveBeenCalledWith("content://video-primary", {
      priority: "eager",
    });
    expect(mockResolveVideoThumbnail).toHaveBeenCalledWith("file:///video-secondary.mp4", {
      priority: "eager",
    });
  });

  it("uses an image variant directly as the video poster", async () => {
    render(
      <VideoThumbnailPreview
        candidateUris={["https://cdn.example.com/video-poster.webp"]}
        uri="https://cdn.example.com/video.mp4"
      />,
    );

    await waitFor(() => {
      expect(mockResolveVideoThumbnail).not.toHaveBeenCalled();
      expect(expoImageProps.at(-1)?.source).toEqual({
        cacheKey: "https://cdn.example.com/video-poster.webp",
        uri: "https://cdn.example.com/video-poster.webp",
      });
    });
  });

  it("generates a thumbnail for a remote signed video when no poster exists", async () => {
    const thumbnail = { uri: "file:///remote-video-thumb.jpg" } as never;
    mockResolveVideoThumbnail.mockResolvedValue(thumbnail);
    const remoteVideoUri = "https://cdn.example.com/video.mp4?token=signed";

    render(<VideoThumbnailPreview uri={remoteVideoUri} />);

    await waitFor(() => {
      expect(mockResolveVideoThumbnail).toHaveBeenCalledWith(remoteVideoUri, {
        priority: "eager",
      });
      expect(expoImageProps.at(-1)?.source).toBe(thumbnail);
    });
  });
});
