import React from "react";
import { render } from "@testing-library/react-native";
import { AppImage } from "./AppImage";
import { useResolvedMediaUri } from "../media/useResolvedMediaUri";

const expoImageProps: Array<Record<string, unknown>> = [];

jest.mock("expo-image", () => ({
  Image: Object.assign(
    (props: Record<string, unknown>) => {
      expoImageProps.push(props);
      return null;
    },
    { getCachePathAsync: jest.fn(() => new Promise(() => undefined)) },
  ),
}));

jest.mock("../media/useResolvedMediaUri", () => ({
  useResolvedMediaUri: jest.fn((uri: string | null | undefined) => String(uri || "")),
}));

describe("AppImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    expoImageProps.length = 0;
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
    expect(expoImageProps[expoImageProps.length - 1]?.priority).toBe("high");
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
});
