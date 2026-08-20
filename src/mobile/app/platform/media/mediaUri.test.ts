import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("../../platform/storage/securePersist", () => ({
  removeSecurePersistedValue: jest.fn(async () => undefined),
  secureTextStorage: {
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => undefined),
    setItem: jest.fn(async () => undefined),
  },
}));

import {
  MEDIA_URI_CACHE_PERSIST_KEY,
  clearPersistedMediaUriCache,
  getCachedResolvedMediaUri,
  getMediaUriCacheKey,
  getPrefetchableMediaUris,
  rehydratePersistedMediaUriCache,
  resolveMediaUri,
  resolveMediaUris,
} from "../../shared/media/mediaUri";
import {
  configureMediaUrlResolver,
  resetMediaUrlResolver,
} from "../../shared/media/mediaUrlResolver";

const getSignedMediaUrl = jest.fn();
const getSignedMediaUrls = jest.fn();

describe("mediaUri helpers", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-08-19T12:00:00.000Z"));
    configureMediaUrlResolver({
      resolveMediaUrl: getSignedMediaUrl,
      resolveMediaUrls: getSignedMediaUrls,
    });
    await clearPersistedMediaUriCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetMediaUrlResolver();
  });

  it("uses direct remote URLs without re-signing them", async () => {
    const signedUrl = "https://cdn.example.com/avatar-user-1.jpg";

    await expect(resolveMediaUri(signedUrl)).resolves.toBe(signedUrl);
    expect(getCachedResolvedMediaUri(signedUrl)).toBe(signedUrl);
    expect(getSignedMediaUrl).not.toHaveBeenCalled();
  });

  it("re-signs authenticated managed-storage URLs before using them", async () => {
    getSignedMediaUrl.mockResolvedValue(
      "https://project.supabase.co/storage/v1/object/sign/make-e3557d40-media/albums/photo-2.jpg?token=abc",
    );

    await expect(
      resolveMediaUri(
        "https://project.supabase.co/storage/v1/object/authenticated/make-e3557d40-media/albums/photo-2.jpg",
      ),
    ).resolves.toBe(
      "https://project.supabase.co/storage/v1/object/sign/make-e3557d40-media/albums/photo-2.jpg?token=abc",
    );

    expect(getSignedMediaUrl).toHaveBeenCalledWith("albums/photo-2.jpg");
  });

  it("uses public managed-storage URLs directly", async () => {
    const publicUrl =
      "https://project.supabase.co/storage/v1/object/public/make-e3557d40-media/albums/photo-3.jpg";

    await expect(resolveMediaUri(publicUrl)).resolves.toBe(publicUrl);
    expect(getSignedMediaUrl).not.toHaveBeenCalled();
  });

  it("dedupes concurrent signing calls for the same storage path", async () => {
    let resolveSignedUrl: (value: string) => void = () => undefined;
    getSignedMediaUrl.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveSignedUrl = resolve;
        }),
    );

    const first = resolveMediaUri("avatars/user-2/profile.jpg");
    const second = resolveMediaUri("avatars/user-2/profile.jpg");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSignedMediaUrl).toHaveBeenCalledTimes(1);

    resolveSignedUrl("https://cdn.example.com/avatar-user-2.jpg");

    await expect(first).resolves.toBe("https://cdn.example.com/avatar-user-2.jpg");
    await expect(second).resolves.toBe("https://cdn.example.com/avatar-user-2.jpg");
    expect(getCachedResolvedMediaUri("avatars/user-2/profile.jpg")).toBe(
      "https://cdn.example.com/avatar-user-2.jpg",
    );
  });

  it("uses normalized storage paths as cache keys", () => {
    expect(getMediaUriCacheKey(" covers/user-3/cover.jpg ")).toBe("covers/user-3/cover.jpg");
  });

  it("strips the managed bucket prefix from raw object paths", () => {
    expect(getMediaUriCacheKey(" make-e3557d40-media/albums/photo-1.jpg ")).toBe(
      "albums/photo-1.jpg",
    );
  });

  it("collapses signed managed-storage URLs to the same stable cache key", () => {
    expect(
      getMediaUriCacheKey(
        "https://project.supabase.co/storage/v1/object/sign/make-e3557d40-media/avatars/user-3/profile.jpg?token=abc",
      ),
    ).toBe("avatars/user-3/profile.jpg");
  });

  it("normalizes bucket-prefixed content paths before requesting a signed URL", async () => {
    getSignedMediaUrl.mockResolvedValue("https://cdn.example.com/albums/photo-1.jpg");

    await expect(resolveMediaUri("make-e3557d40-media/albums/photo-1.jpg")).resolves.toBe(
      "https://cdn.example.com/albums/photo-1.jpg",
    );

    expect(getSignedMediaUrl).toHaveBeenCalledWith("albums/photo-1.jpg");
  });

  it("resolves URI batches and drops failed entries", async () => {
    getSignedMediaUrls.mockResolvedValue({
      "avatars/user-4/profile.jpg": "https://cdn.example.com/avatars/user-4/profile.jpg",
    });

    await expect(
      resolveMediaUris([
        "avatars/user-4/profile.jpg",
        "avatars/user-4/profile.jpg",
        "events/user-4/cover.jpg",
      ]),
    ).resolves.toEqual(["https://cdn.example.com/avatars/user-4/profile.jpg"]);
    expect(getSignedMediaUrls).toHaveBeenCalledWith([
      "avatars/user-4/profile.jpg",
      "events/user-4/cover.jpg",
    ]);
  });

  it("keeps cache-only media resolution off the signing hot path", async () => {
    await expect(
      resolveMediaUris(["avatars/user-8/profile.jpg", "https://cdn.example.com/direct-cover.jpg"], {
        allowNetworkResolve: false,
      }),
    ).resolves.toEqual(["https://cdn.example.com/direct-cover.jpg"]);

    expect(getSignedMediaUrls).not.toHaveBeenCalled();
    expect(getSignedMediaUrl).not.toHaveBeenCalled();
  });

  it("only returns direct or already-cached URIs for prefetch", async () => {
    getSignedMediaUrl.mockResolvedValue("https://cdn.example.com/avatars/user-5/profile.jpg");
    await resolveMediaUri("avatars/user-5/profile.jpg");

    expect(
      getPrefetchableMediaUris([
        "avatars/user-5/profile.jpg",
        "avatars/user-6/profile.jpg",
        "https://cdn.example.com/direct-cover.jpg",
      ]),
    ).toEqual([
      "https://cdn.example.com/avatars/user-5/profile.jpg",
      "https://cdn.example.com/direct-cover.jpg",
    ]);
  });

  it("rehydrates persisted signed URLs for repeat launches", async () => {
    const signedUrl = "https://cdn.example.com/avatars/user-7/profile.jpg";
    await AsyncStorage.setItem(
      MEDIA_URI_CACHE_PERSIST_KEY,
      JSON.stringify([
        {
          cacheKey: "avatars/user-7/profile.jpg",
          expiresAt: Date.parse("2026-08-19T12:01:00.000Z"),
          url: signedUrl,
        },
      ]),
    );

    await rehydratePersistedMediaUriCache();

    expect(getCachedResolvedMediaUri("avatars/user-7/profile.jpg")).toBe(signedUrl);
    expect(getSignedMediaUrl).not.toHaveBeenCalled();
  });

  it("waits for persisted cache rehydration before signing first-fold media", async () => {
    const signedUrl = "https://cdn.example.com/avatars/user-9/profile.jpg";
    await AsyncStorage.setItem(
      MEDIA_URI_CACHE_PERSIST_KEY,
      JSON.stringify([
        {
          cacheKey: "avatars/user-9/profile.jpg",
          expiresAt: Date.parse("2026-08-19T12:01:00.000Z"),
          url: signedUrl,
        },
      ]),
    );

    await expect(resolveMediaUri("avatars/user-9/profile.jpg")).resolves.toBe(signedUrl);
    expect(getSignedMediaUrl).not.toHaveBeenCalled();
  });
});
