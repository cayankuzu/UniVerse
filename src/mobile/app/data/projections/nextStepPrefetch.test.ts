import { QueryClient } from "@tanstack/react-query";
import { prefetchHomeNextStepExperience } from "./prefetch/nextStepPrefetch";
import { prefetchEventExperience, prefetchProfileExperience } from "./prefetch/intentPrefetch";
import { preloadMediaSources } from "../../shared/media/preloadMediaSources";

jest.mock("../../shared/media/preloadMediaSources", () => ({
  preloadMediaSources: jest.fn().mockResolvedValue(1),
}));

jest.mock("./networkAwareBudget", () => ({
  resolveNetworkBudget: () => ({
    allowIdlePrefetch: true,
    allowImagePrefetch: true,
    allowIntentPrefetch: true,
    allowNextPagePrefetch: true,
    quality: "good",
  }),
}));

jest.mock("./prefetch/intentPrefetch", () => ({
  prefetchEventExperience: jest.fn().mockResolvedValue(undefined),
  prefetchProfileExperience: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../shared/media/mediaUri", () => ({
  getMediaUriCacheKey: jest.fn((uri: string) => uri),
  resolveMediaUris: jest.fn((uris: string[]) => Promise.resolve(uris)),
}));

jest.mock("../../platform/observability", () => ({
  logProjectionMetric: jest.fn(),
}));

describe("nextStepPrefetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefetches thumbnail variants only", async () => {
    await prefetchHomeNextStepExperience({
      items: [
        {
          event: {
            clubUsername: "club",
            id: "event-1",
            image: "https://cdn.example.com/event-full.jpg",
            imageVariants: {
              medium: "https://cdn.example.com/event-medium.jpg",
              thumbnail: "https://cdn.example.com/event-thumb.jpg",
            },
          },
          id: "event:event-1",
          kind: "event",
          source: "own",
        },
      ] as any,
      prefetchedImageUris: new Set<string>(),
      prefetchedTargets: new Set<string>(),
      queryClient: new QueryClient(),
      viewerId: "viewer-id",
      viewerKey: "viewer-key",
      viewerUsername: "viewer",
    });

    expect(prefetchEventExperience).toHaveBeenCalledTimes(1);
    expect(prefetchProfileExperience).toHaveBeenCalledTimes(1);
    expect(preloadMediaSources).toHaveBeenCalledWith(
      expect.arrayContaining(["https://cdn.example.com/event-thumb.jpg"]),
      {
        allowNetworkResolve: false,
        batchSize: 1,
      },
    );
    expect(preloadMediaSources).not.toHaveBeenCalledWith(
      expect.arrayContaining(["https://cdn.example.com/event-full.jpg"]),
      expect.anything(),
    );
    expect(preloadMediaSources).not.toHaveBeenCalledWith(
      expect.arrayContaining(["https://cdn.example.com/event-medium.jpg"]),
      expect.anything(),
    );
  });

  it("skips image prefetch when only full-size fallbacks are available", async () => {
    await prefetchHomeNextStepExperience({
      items: [
        {
          event: {
            clubUsername: "club",
            id: "event-1",
            image: "https://cdn.example.com/event-original.jpg",
            imageVariants: {
              full: "https://cdn.example.com/event-full-variant.jpg",
            },
          },
          id: "event:event-1",
          kind: "event",
          source: "own",
        },
      ] as any,
      prefetchedImageUris: new Set<string>(),
      prefetchedTargets: new Set<string>(),
      queryClient: new QueryClient(),
      viewerId: "viewer-id",
      viewerKey: "viewer-key",
      viewerUsername: "viewer",
    });

    expect(preloadMediaSources).not.toHaveBeenCalled();
  });
});
