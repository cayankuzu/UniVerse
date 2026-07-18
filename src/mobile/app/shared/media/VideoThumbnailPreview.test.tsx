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

    const { VideoThumbnailPreview } =
      require("./VideoThumbnailPreview") as typeof import("./VideoThumbnailPreview");

    render(
      <VideoThumbnailPreview
        candidateUris={["content://video-primary", "file:///video-secondary.mp4"]}
        uri="content://video-primary"
      />,
    );

    await waitFor(() => {
      expect(mockResolveVideoThumbnail).toHaveBeenNthCalledWith(1, "content://video-primary", {
        priority: "eager",
      });
      expect(mockResolveVideoThumbnail).toHaveBeenNthCalledWith(2, "file:///video-secondary.mp4", {
        priority: "eager",
      });
    });
  });

  it("uses an image variant directly as the video poster", async () => {
    const { VideoThumbnailPreview } =
      require("./VideoThumbnailPreview") as typeof import("./VideoThumbnailPreview");

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
});
