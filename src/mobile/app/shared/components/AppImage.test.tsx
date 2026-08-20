import React from "react";
import { act, render } from "@testing-library/react-native";
import { AppImage } from "./AppImage";
import { useResolvedMediaUri } from "../media/useResolvedMediaUri";

const mockExpoImageProps: Array<Record<string, unknown>> = [];

jest.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) => {
    mockExpoImageProps.push(props);
    return null;
  },
}));

jest.mock("../media/useResolvedMediaUri", () => ({
  useResolvedMediaUri: jest.fn((uri: string | null | undefined) => String(uri || "")),
}));

describe("AppImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExpoImageProps.length = 0;
  });

  it("defers normal thumbnail resolution and keeps retry enabled", () => {
    render(
      <AppImage uri="albums/photo-1.jpg" variant="thumbnail" style={{ width: 120, height: 120 }} />,
    );

    expect(useResolvedMediaUri).toHaveBeenNthCalledWith(1, "albums/photo-1.jpg", {
      priority: "deferred",
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
      priority: "deferred",
      retry: true,
    });
    expect(useResolvedMediaUri).toHaveBeenNthCalledWith(2, "albums/photo-thumbnail.jpg", {
      priority: "deferred",
      retry: true,
    });
  });

  it("uses an instant transition for local media", () => {
    render(<AppImage uri="file:///photo.jpg" style={{ width: 20, height: 20 }} />);

    expect(mockExpoImageProps[mockExpoImageProps.length - 1]?.transition).toBe(0);
  });

  it("delegates remote caching to Expo Image with a stable cache key", () => {
    render(<AppImage uri="https://cdn.example.com/photo.jpg" style={{ width: 20, height: 20 }} />);

    const props = mockExpoImageProps[mockExpoImageProps.length - 1];
    expect(props?.cachePolicy).toBe("memory-disk");
    expect(props?.source).toEqual({
      cacheKey: "https://cdn.example.com/photo.jpg",
      uri: "https://cdn.example.com/photo.jpg",
    });
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
