import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { AppImage } from "./AppImage";
import { useResolvedMediaUri } from "../media/useResolvedMediaUri";

const mockExpoImageProps: Array<Record<string, unknown>> = [];

jest.mock("expo-image", () => ({
  Image: Object.assign(
    (props: Record<string, unknown>) => {
      mockExpoImageProps.push(props);
      return null;
    },
    { getCachePathAsync: jest.fn(() => new Promise<string | null>(() => undefined)) },
  ),
}));

const mockGetCachePathAsync = (
  jest.requireMock("expo-image") as { Image: { getCachePathAsync: jest.Mock } }
).Image.getCachePathAsync;

jest.mock("../media/useResolvedMediaUri", () => ({
  useResolvedMediaUri: jest.fn((uri: string | null | undefined) => String(uri || "")),
}));

describe("AppImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExpoImageProps.length = 0;
    mockGetCachePathAsync.mockImplementation(() => new Promise<string | null>(() => undefined));
  });

  it("starts private thumbnail resolution immediately and keeps retry enabled", () => {
    render(
      <AppImage uri="albums/photo-1.jpg" variant="thumbnail" style={{ width: 120, height: 120 }} />,
    );

    expect(useResolvedMediaUri).toHaveBeenNthCalledWith(1, "albums/photo-1.jpg", {
      priority: "eager",
      retry: true,
    });
  });

  it("uses image high priority only when explicitly requested", () => {
    render(
      <AppImage
        highPriority
        uri="albums/photo-2.jpg"
        variant="thumbnail"
        style={{ width: 120, height: 120 }}
      />,
    );

    expect(useResolvedMediaUri).toHaveBeenNthCalledWith(1, "albums/photo-2.jpg", {
      priority: "eager",
      retry: true,
    });
    expect(mockExpoImageProps[mockExpoImageProps.length - 1]?.priority).toBe("high");
  });

  it("resolves a thumbnail preview alongside medium media for instant feedback", () => {
    render(
      <AppImage
        uri="albums/photo-full.jpg"
        variants={{
          medium: "albums/photo-medium.jpg",
          thumbnail: "albums/photo-thumbnail.jpg",
        }}
        variant="medium"
        style={{ width: 240, height: 180 }}
      />,
    );

    expect(useResolvedMediaUri).toHaveBeenNthCalledWith(1, "albums/photo-medium.jpg", {
      priority: "eager",
      retry: true,
    });
    expect(useResolvedMediaUri).toHaveBeenNthCalledWith(2, "albums/photo-thumbnail.jpg", {
      priority: "eager",
      retry: true,
    });
  });

  it("uses an instant transition for local media without consulting the disk cache", () => {
    render(<AppImage uri="file:///photo.jpg" style={{ width: 20, height: 20 }} />);

    expect(mockGetCachePathAsync).not.toHaveBeenCalled();
    expect(mockExpoImageProps[mockExpoImageProps.length - 1]?.transition).toBe(0);
  });

  it("resolves disk cache hits and misses for remote media", async () => {
    mockGetCachePathAsync.mockResolvedValueOnce("file:///cached.jpg");
    const { unmount } = render(
      <AppImage uri="https://cdn.example.com/photo.jpg" style={{ width: 20, height: 20 }} />,
    );

    await waitFor(() => expect(mockGetCachePathAsync).toHaveBeenCalled());
    unmount();

    mockGetCachePathAsync.mockRejectedValueOnce(new Error("cache unavailable"));
    render(<AppImage uri="https://cdn.example.com/second.jpg" style={{ width: 20, height: 20 }} />);
    await waitFor(() => expect(mockGetCachePathAsync).toHaveBeenCalledTimes(2));
  });

  it("forwards native image lifecycle events", () => {
    const onError = jest.fn();
    const onLoad = jest.fn();
    const onLoadStart = jest.fn();
    render(
      <AppImage
        onError={onError}
        onLoad={onLoad}
        onLoadStart={onLoadStart}
        uri="file:///photo.jpg"
        style={{ width: 20, height: 20 }}
      />,
    );
    const props = mockExpoImageProps[mockExpoImageProps.length - 1];

    act(() => {
      (props?.onLoadStart as () => void)();
      (props?.onError as (event: unknown) => void)({ error: "failed" });
      (props?.onLoad as (event: unknown) => void)({ source: "disk" });
    });

    expect(onLoadStart).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
