import { Image as ExpoImage } from "expo-image";
import {
  preloadMediaSources,
  preloadResolvedMediaSources,
} from "../../shared/media/preloadMediaSources";

jest.mock("expo-image", () => ({
  Image: {
    loadAsync: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("../../shared/media/mediaUri", () => ({
  resolveMediaSources: jest.fn(),
}));

const { resolveMediaSources } = jest.requireMock("../../shared/media/mediaUri") as {
  resolveMediaSources: jest.Mock;
};

describe("preloadMediaSources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads resolved sources with stable cache keys", async () => {
    await preloadResolvedMediaSources([
      {
        cacheKey: "events/event-1/cover.jpg",
        uri: "https://cdn.example.com/event-1-cover.jpg",
      },
    ]);

    expect(ExpoImage.loadAsync).toHaveBeenCalledWith({
      cacheKey: "events/event-1/cover.jpg",
      uri: "https://cdn.example.com/event-1-cover.jpg",
    });
  });

  it("resolves raw URIs before loading them into cache", async () => {
    resolveMediaSources.mockResolvedValue([
      {
        cacheKey: "avatars/user-1/profile.jpg",
        uri: "https://cdn.example.com/avatars/user-1/profile.jpg",
      },
    ]);

    await expect(preloadMediaSources(["avatars/user-1/profile.jpg"])).resolves.toBe(1);

    expect(resolveMediaSources).toHaveBeenCalledWith(["avatars/user-1/profile.jpg"], {
      allowNetworkResolve: undefined,
    });
    expect(ExpoImage.loadAsync).toHaveBeenCalledTimes(1);
  });

  it("can resolve preloads in cache-only mode", async () => {
    resolveMediaSources.mockResolvedValue([]);

    await expect(
      preloadMediaSources(["avatars/user-2/profile.jpg"], {
        allowNetworkResolve: false,
      }),
    ).resolves.toBe(0);

    expect(resolveMediaSources).toHaveBeenCalledWith(["avatars/user-2/profile.jpg"], {
      allowNetworkResolve: false,
    });
  });
});
