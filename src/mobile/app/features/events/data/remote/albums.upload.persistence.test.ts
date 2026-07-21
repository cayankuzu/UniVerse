import {
  ensureAlbumUploadAllowed,
  getAlbumUploadAvailability,
  getAlbumUploadAvailabilityForAuthContext,
  writeAlbumPhotoToTable,
} from "./albums.upload.persistence";
import { recoverAuthState } from "../../../../platform/supabase/authSession";

const mockTokenClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock("../../../../platform/supabase", () => ({
  createSupabaseAccessTokenClient: jest.fn(() => mockTokenClient),
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../../../../platform/supabase/authSession", () => ({
  recoverAuthState: jest.fn(),
}));

jest.mock("../../../../platform/supabase/sessionRefresh", () => ({
  refreshSupabaseSessionSingleFlight: jest.fn(),
}));

jest.mock("./albums.owner", () => ({
  hydrateAlbumOwnerProfiles: jest.fn(async (items: unknown[]) => items),
}));

jest.mock("../../../../data/content/albums/albums.local", () => ({
  persistLocalAlbumShadow: jest.fn(async () => undefined),
}));

type ClientOptions = {
  attendeeError?: boolean;
  capabilityCode?: string | null;
  ownAlbumsError?: boolean;
};

function createClient(options: ClientOptions = {}) {
  const client = {
    from: jest.fn((table: string) => {
      if (table === "events") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: { club_id: "club-id", id: "event-id" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "album_photos") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: async () => ({
                  data: [],
                  error: options.ownAlbumsError ? { message: "failed" } : null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "event_attendees") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: options.attendeeError ? { message: "failed" } : null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: jest.fn(async () => ({
      data:
        options.capabilityCode === null
          ? null
          : {
              can_upload_event_album: false,
              locked_reason_code: options.capabilityCode,
              locked_reason_text: null,
            },
      error: options.capabilityCode === null ? { message: "unavailable" } : null,
    })),
  };
  return client;
}

function authContext(client: ReturnType<typeof createClient>, userId = "viewer-id") {
  return { accessToken: "token", client, userId } as never;
}

describe("album upload persistence guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (recoverAuthState as jest.Mock).mockResolvedValue(null);
  });

  it.each(["EVENT_ENDED", "FOLLOW_REQUIRED", "UNAUTHORIZED", "CLUB_ACCOUNT_NOT_ALLOWED"])(
    "turns the %s capability into a user-facing denial",
    async (capabilityCode) => {
      const availability = await getAlbumUploadAvailabilityForAuthContext(
        "event-id",
        authContext(createClient({ capabilityCode })),
      );

      expect(availability).toMatchObject({ canUpload: false });
      expect(availability.reason).toEqual(expect.any(String));
    },
  );

  it("rejects an auth context without a user id", async () => {
    await expect(
      getAlbumUploadAvailabilityForAuthContext("event-id", authContext(createClient(), "")),
    ).rejects.toThrow();
  });

  it("reports own-album lookup failures", async () => {
    await expect(
      getAlbumUploadAvailabilityForAuthContext(
        "event-id",
        authContext(createClient({ ownAlbumsError: true })),
      ),
    ).rejects.toThrow();
  });

  it("reports attendee lookup failures when capability RPC is unavailable", async () => {
    await expect(
      getAlbumUploadAvailabilityForAuthContext(
        "event-id",
        authContext(createClient({ attendeeError: true, capabilityCode: null })),
      ),
    ).rejects.toThrow();
  });

  it("rejects global availability without recoverable auth", async () => {
    await expect(getAlbumUploadAvailability("event-id", "viewer-id")).rejects.toThrow();
  });

  it("enforces a denied availability through the public guard", async () => {
    const client = createClient({ capabilityCode: "UNAUTHORIZED" });
    mockTokenClient.from.mockImplementation(client.from);
    mockTokenClient.rpc.mockImplementation(client.rpc);
    (recoverAuthState as jest.Mock).mockResolvedValue({
      accessToken: "token",
      user: { id: "viewer-id" },
    });

    await expect(ensureAlbumUploadAllowed("event-id", "viewer-id")).rejects.toThrow();
  });

  it("rejects album cards with more than six media items before persistence", async () => {
    await expect(
      writeAlbumPhotoToTable({
        client: createClient() as never,
        payload: {
          eventId: "event-id",
          images: Array.from({ length: 7 }, (_, index) => `albums/${index}.jpg`),
        } as never,
        userId: "viewer-id",
      }),
    ).rejects.toThrow();
  });
});
