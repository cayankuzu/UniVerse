import { persistAlbumUpload } from "./albums.upload";

jest.mock("../../../../platform/api/core", () => ({
  post: jest.fn(),
}));

jest.mock("../../../../platform/supabase", () => ({
  __tokenScopedSupabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
  createSupabaseAccessTokenClient: jest.fn(function createSupabaseAccessTokenClient() {
    return jest.requireMock("../../../../platform/supabase").__tokenScopedSupabase;
  }),
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
    },
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

jest.mock("./albums.owner", () => ({
  hydrateAlbumOwnerProfiles: jest.fn(async (items: unknown[]) => items),
}));

jest.mock("../../../../data/content/albums/albums.local", () => ({
  persistLocalAlbumShadow: jest.fn(async () => undefined),
}));

jest.mock("../../../../data/profile/profileDisplay", () => ({
  toDisplayName: jest.fn((profile: { name?: string; club_name?: string; username?: string }) =>
    String(profile?.name || profile?.club_name || profile?.username || "").trim(),
  ),
}));

const { post } = jest.requireMock("../../../../platform/api/core") as {
  post: jest.Mock;
};

const { supabase } = jest.requireMock("../../../../platform/supabase") as {
  __tokenScopedSupabase: {
    from: jest.Mock;
    rpc: jest.Mock;
  };
  createSupabaseAccessTokenClient: jest.Mock;
  supabase: {
    auth: {
      getSession: jest.Mock;
      getUser: jest.Mock;
      refreshSession: jest.Mock;
    };
    rpc: jest.Mock;
    from: jest.Mock;
  };
};
const tokenScopedSupabase = (
  jest.requireMock("../../../../platform/supabase") as {
    __tokenScopedSupabase: {
      from: jest.Mock;
      rpc: jest.Mock;
    };
  }
).__tokenScopedSupabase;

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");

function mockSupabaseForAlbumUpload() {
  let rpcCount = 0;
  const fromImplementation = (table: string) => {
    if (table === "events") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            is: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  club_id: "",
                  ends_at: "2026-03-13T00:00:00.000Z",
                  id: "event-1",
                  is_cancelled: false,
                  visibility: "public",
                },
                error: null,
              }),
            })),
          })),
        })),
      };
    }

    if (table === "event_attendees") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { event_id: "event-1" },
                error: null,
              }),
            })),
          })),
        })),
      };
    }

    if (table === "album_photos") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      };
    }

    if (table === "profiles") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            is: jest.fn(() => ({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  is_private: false,
                  name: "Viewer Name",
                  profile_image_path: "avatars/viewer.jpg",
                  university: "Test Uni",
                  username: "viewer",
                },
                error: null,
              }),
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  };

  const rpcImplementation = async (fn: string, args: Record<string, unknown>) => {
    if (fn === "get_event_capabilities") {
      return {
        data: {
          can_upload_event_album: true,
          locked_reason_code: null,
          locked_reason_text: null,
        },
        error: null,
      };
    }

    if (fn !== "create_album_photo_with_patch") {
      throw new Error(`Unexpected rpc: ${fn}`);
    }
    rpcCount += 1;
    if (rpcCount === 1) {
      return { data: null, error: { message: "Invalid JWT" } };
    }
    return {
      data: {
        created_at: "2026-03-13T00:00:00.000Z",
        id: "album-photo-1",
        media_paths: args.target_media_paths,
        storage_path: args.target_storage_path,
      },
      error: null,
    };
  };

  supabase.from.mockImplementation(fromImplementation);
  tokenScopedSupabase.from.mockImplementation(fromImplementation);
  supabase.rpc.mockImplementation(rpcImplementation);
  tokenScopedSupabase.rpc.mockImplementation(rpcImplementation);
}

describe("persistAlbumUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token", user: { id: "viewer-id" } } },
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
    });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
      error: null,
    });
    mockSupabaseForAlbumUpload();
  });

  afterEach(() => {
    if (originalCryptoDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
    } else {
      delete (globalThis as { crypto?: Crypto }).crypto;
    }
  });

  it("retries the direct sql album write after refreshing auth and does not fall back to /albums", async () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });

    await expect(
      persistAlbumUpload({
        caption: "Album caption",
        clientMutationId: "album-upload:client-1",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "albums/photo-1.jpg",
        showOnClubProfile: true,
        showOnOwnProfile: true,
      }),
    ).resolves.toMatchObject({
      caption: "Album caption",
      eventId: "event-1",
      eventTitle: "Event Title",
      image: "albums/photo-1.jpg",
      id: "album-photo-1",
      showOnClubProfile: true,
      showOnOwnProfile: true,
      showOnProfile: true,
      userId: "viewer-id",
      username: "viewer",
    });

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it("recovers the viewer from a refreshed session before starting the album write", async () => {
    supabase.auth.getSession
      .mockResolvedValueOnce({
        data: { session: null },
      })
      .mockResolvedValue({
        data: {
          session: {
            access_token: "fresh-token",
            user: { id: "viewer-id" },
          },
        },
      });
    supabase.auth.getUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })
      .mockResolvedValue({
        data: { user: { id: "viewer-id" } },
        error: null,
      });
    supabase.auth.refreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "fresh-token",
          user: { id: "viewer-id" },
        },
      },
      error: null,
    });

    await expect(
      persistAlbumUpload({
        caption: "Album caption",
        clientMutationId: "album-upload:client-2",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "albums/photo-2.jpg",
        showOnClubProfile: true,
        showOnOwnProfile: true,
      }),
    ).resolves.toMatchObject({
      eventId: "event-1",
      id: "album-photo-1",
      image: "albums/photo-2.jpg",
      userId: "viewer-id",
      username: "viewer",
    });

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(2);
    expect(post).not.toHaveBeenCalled();
  });

  it("falls back to /albums when the direct sql write remains unauthorized", async () => {
    tokenScopedSupabase.rpc.mockImplementation(async (fn: string) => {
      if (fn === "get_event_capabilities") {
        return {
          data: {
            can_upload_event_album: true,
            locked_reason_code: null,
            locked_reason_text: null,
          },
          error: null,
        };
      }
      return {
        data: null,
        error: { message: "Unauthorized" },
      };
    });
    supabase.auth.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "refresh failed" },
    });
    post.mockResolvedValue({
      caption: "Album caption",
      comments: 0,
      createdAt: "2026-03-13T00:00:00.000Z",
      eventId: "event-1",
      eventTitle: "Event Title",
      id: "album-photo-fallback",
      image: "albums/photo-3.jpg",
      images: ["albums/photo-3.jpg"],
      liked: false,
      likes: 0,
      name: "Viewer Name",
      photoCount: 1,
      showOnClubProfile: true,
      showOnOwnProfile: true,
      showOnProfile: true,
      userId: "viewer-id",
      userImage: "avatars/viewer.jpg",
      userUniversity: "Test Uni",
      username: "viewer",
    });

    await expect(
      persistAlbumUpload({
        caption: "Album caption",
        clientMutationId: "album-upload:client-3",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "albums/photo-3.jpg",
        showOnClubProfile: true,
        showOnOwnProfile: true,
      }),
    ).resolves.toMatchObject({
      eventId: "event-1",
      id: "album-photo-fallback",
      image: "albums/photo-3.jpg",
      userId: "viewer-id",
      username: "viewer",
    });

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/albums", {
      caption: "Album caption",
      clientMutationId: "album-upload:client-3",
      eventId: "event-1",
      eventTitle: "Event Title",
      image: "albums/photo-3.jpg",
      images: ["albums/photo-3.jpg"],
      showOnClubProfile: true,
      showOnOwnProfile: true,
    });
  });

  it("returns the capability reason instead of surfacing a raw unauthorized upload error", async () => {
    tokenScopedSupabase.rpc.mockImplementation(async (fn: string) => {
      if (fn === "get_event_capabilities") {
        return {
          data: {
            can_upload_event_album: false,
            locked_reason_code: "EVENT_ENDED",
            locked_reason_text: "Bu etkinlik sona erdigi icin album yukleme izni su anda kapali.",
          },
          error: null,
        };
      }
      throw new Error(`Unexpected rpc: ${fn}`);
    });

    await expect(
      persistAlbumUpload({
        caption: "Album caption",
        clientMutationId: "album-upload:client-4",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "albums/photo-4.jpg",
        showOnClubProfile: true,
        showOnOwnProfile: true,
      }),
    ).rejects.toThrow("Bu etkinlik sona erdigi icin album yukleme izni su anda kapali.");

    expect(post).not.toHaveBeenCalled();
  });
});
