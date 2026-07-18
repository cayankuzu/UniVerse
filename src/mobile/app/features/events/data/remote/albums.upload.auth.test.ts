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
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../../../../platform/supabase/authSession", () => ({
  recoverAuthState: jest.fn(),
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
const { recoverAuthState } = jest.requireMock("../../../../platform/supabase/authSession") as {
  recoverAuthState: jest.Mock;
};

const { supabase, __tokenScopedSupabase } = jest.requireMock("../../../../platform/supabase") as {
  __tokenScopedSupabase: {
    from: jest.Mock;
    rpc: jest.Mock;
  };
  supabase: {
    auth: {
      getSession: jest.Mock;
      getUser: jest.Mock;
      refreshSession: jest.Mock;
    };
    from: jest.Mock;
    rpc: jest.Mock;
  };
};

function buildScopedFromMock(table: string) {
  if (table === "events") {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          is: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                club_id: "",
                id: "event-1",
                visibility: "public",
              },
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
}

describe("persistAlbumUpload auth recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recoverAuthState.mockResolvedValue({
      accessToken: "session-token",
      user: { id: "viewer-id" },
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token", user: { id: "viewer-id" } } },
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "viewer-id" } },
      error: null,
    });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token", user: { id: "viewer-id" } } },
      error: null,
    });
  });

  it("writes album cards through the recovered access-token client when the global client is stale", async () => {
    supabase.from.mockImplementation(() => {
      throw new Error("global-client-should-not-be-used");
    });
    supabase.rpc.mockImplementation(async () => {
      throw new Error("global-client-should-not-be-used");
    });

    __tokenScopedSupabase.from.mockImplementation(buildScopedFromMock);
    __tokenScopedSupabase.rpc.mockImplementation(
      async (fn: string, args: Record<string, unknown>) => {
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

        if (fn === "create_album_photo_with_patch") {
          return {
            data: {
              created_at: "2026-03-13T00:00:00.000Z",
              id: "album-photo-1",
              media_paths: args.target_media_paths,
              storage_path: args.target_storage_path,
            },
            error: null,
          };
        }

        throw new Error(`Unexpected rpc: ${fn}`);
      },
    );

    await expect(
      persistAlbumUpload({
        caption: "Album caption",
        clientMutationId: "album-upload:auth-token-client",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "albums/photo-token.jpg",
        showOnClubProfile: true,
        showOnOwnProfile: true,
      }),
    ).resolves.toMatchObject({
      eventId: "event-1",
      id: "album-photo-1",
      image: "albums/photo-token.jpg",
      userId: "viewer-id",
      username: "viewer",
    });

    expect(post).not.toHaveBeenCalled();
  });

  it("uses recovered auth state when the immediate supabase session is temporarily empty", async () => {
    recoverAuthState.mockResolvedValueOnce({
      accessToken: "recovered-token",
      user: { id: "viewer-id" },
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    __tokenScopedSupabase.from.mockImplementation(buildScopedFromMock);
    __tokenScopedSupabase.rpc.mockImplementation(
      async (fn: string, args: Record<string, unknown>) => {
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

        if (fn === "create_album_photo_with_patch") {
          return {
            data: {
              created_at: "2026-03-13T00:00:00.000Z",
              id: "album-photo-2",
              media_paths: args.target_media_paths,
              storage_path: args.target_storage_path,
            },
            error: null,
          };
        }

        throw new Error(`Unexpected rpc: ${fn}`);
      },
    );

    await expect(
      persistAlbumUpload({
        caption: "Album caption",
        clientMutationId: "album-upload:auth-recovery",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "albums/photo-recovered.jpg",
        showOnClubProfile: true,
        showOnOwnProfile: true,
      }),
    ).resolves.toMatchObject({
      eventId: "event-1",
      id: "album-photo-2",
      image: "albums/photo-recovered.jpg",
      userId: "viewer-id",
      username: "viewer",
    });

    expect(recoverAuthState).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("uses queued auth hints when global auth recovery is temporarily unavailable", async () => {
    recoverAuthState.mockResolvedValueOnce({
      accessToken: null,
      user: null,
    });

    __tokenScopedSupabase.from.mockImplementation(buildScopedFromMock);
    __tokenScopedSupabase.rpc.mockImplementation(
      async (fn: string, args: Record<string, unknown>) => {
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

        if (fn === "create_album_photo_with_patch") {
          return {
            data: {
              created_at: "2026-03-13T00:00:00.000Z",
              id: "album-photo-3",
              media_paths: args.target_media_paths,
              storage_path: args.target_storage_path,
            },
            error: null,
          };
        }

        throw new Error(`Unexpected rpc: ${fn}`);
      },
    );

    await expect(
      persistAlbumUpload(
        {
          caption: "Album caption",
          clientMutationId: "album-upload:queued-auth-hints",
          eventId: "event-1",
          eventTitle: "Event Title",
          image: "albums/photo-hinted.jpg",
          showOnClubProfile: true,
          showOnOwnProfile: true,
        },
        {
          accessTokenHint: "queued-token",
          userIdHint: "viewer-id",
        },
      ),
    ).resolves.toMatchObject({
      eventId: "event-1",
      id: "album-photo-3",
      image: "albums/photo-hinted.jpg",
      userId: "viewer-id",
      username: "viewer",
    });

    expect(post).not.toHaveBeenCalled();
  });

  it("marks album session write failures as retryable for the upload queue", async () => {
    __tokenScopedSupabase.from.mockImplementation(buildScopedFromMock);
    __tokenScopedSupabase.rpc.mockImplementation(async (fn: string) => {
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

      if (fn === "create_album_photo_with_patch") {
        return {
          data: null,
          error: { message: "invalid JWT" },
        };
      }

      throw new Error(`Unexpected rpc: ${fn}`);
    });
    supabase.auth.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    post.mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(
      persistAlbumUpload({
        caption: "Album caption",
        clientMutationId: "album-upload:retryable-auth",
        eventId: "event-1",
        eventTitle: "Event Title",
        image: "albums/photo-auth-error.jpg",
        showOnClubProfile: true,
        showOnOwnProfile: true,
      }),
    ).rejects.toMatchObject({
      message: "Oturum dogrulanamadi. Uygulamayi yeniden acip tekrar dene.",
      retryableQueueError: true,
    });
  });
});
