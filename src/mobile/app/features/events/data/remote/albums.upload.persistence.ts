import { createSupabaseAccessTokenClient, supabase } from "../../../../platform/supabase";
import { recoverAuthState } from "../../../../platform/supabase/authSession";
import { refreshSupabaseSessionSingleFlight } from "../../../../platform/supabase/sessionRefresh";
import { persistLocalAlbumShadow } from "../../../../data/content/albums/albums.local";
import { resolveAlbumSurfaceVisibility } from "../../../../data/normalizers/albums";
import { toDisplayName } from "../../../../data/profile/profileDisplay";
import { hydrateAlbumOwnerProfiles } from "./albums.owner";
import type { AlbumPhotoWithMeta, UploadPhotoPayload } from "./albums.shared";
import {
  createAlbumPhotoId,
  MAX_EVENT_ALBUM_CARDS,
  MAX_EVENT_ALBUM_PHOTOS,
  normalizeImages,
  normalizeProfileSurfaceVisibility,
  type AlbumUploadAvailability,
} from "./albums.upload.shared";

type EventUploadCapabilitiesRow = {
  can_upload_event_album?: boolean | null;
  locked_reason_code?: string | null;
  locked_reason_text?: string | null;
};

type AlbumUploadClient = {
  from: typeof supabase.from;
  rpc: typeof supabase.rpc;
};

type AlbumUploadAuthContext = {
  accessToken: string;
  client: AlbumUploadClient;
  userId: string;
};

type ReadAlbumUploadAuthContextOptions = {
  accessTokenHint?: string;
  preferHints?: boolean;
  userIdHint?: string;
};

function normalizeAlbumUploadPersistenceText(value: unknown) {
  return String(value || "").trim();
}

function normalizeAlbumUploadPersistenceUserId(value: unknown) {
  return normalizeAlbumUploadPersistenceText(value);
}

function resolveAlbumUploadCapabilityReason(capabilities: EventUploadCapabilitiesRow | null) {
  const reasonText = normalizeAlbumUploadPersistenceText(capabilities?.locked_reason_text);
  if (reasonText) {
    return reasonText;
  }

  const reasonCode = normalizeAlbumUploadPersistenceText(
    capabilities?.locked_reason_code,
  ).toUpperCase();
  switch (reasonCode) {
    case "EVENT_ENDED":
      return "Bu etkinlik sona erdiği için albüm yükleme izni şu anda kapalı.";
    case "FOLLOW_REQUIRED":
      return "Bu albüme medya yüklemek için önce ilgili kulübü takip etmelisin.";
    case "UNAUTHORIZED":
      return "Albüm yüklemek için önce giriş yapmalısın.";
    case "CLUB_ACCOUNT_NOT_ALLOWED":
      return "Kulüp hesapları bu etkinliğe katılımcı olarak albüm yükleyemez.";
    default:
      return "";
  }
}

export async function readAlbumUploadAuthContext(
  options: ReadAlbumUploadAuthContextOptions = {},
): Promise<AlbumUploadAuthContext | null> {
  const accessTokenHint = normalizeAlbumUploadPersistenceText(options.accessTokenHint);
  const userIdHint = normalizeAlbumUploadPersistenceUserId(options.userIdHint);
  if (options.preferHints && accessTokenHint && userIdHint) {
    const directUserId = normalizeAlbumUploadPersistenceUserId(
      (await supabase.auth.getUser(accessTokenHint).catch(() => null))?.data.user?.id,
    );
    if (directUserId) {
      return {
        accessToken: accessTokenHint,
        client: createSupabaseAccessTokenClient(accessTokenHint),
        userId: directUserId,
      };
    }
  }

  const recoveredAuthState = await recoverAuthState().catch(() => null);
  const accessToken = normalizeAlbumUploadPersistenceText(
    recoveredAuthState?.accessToken || accessTokenHint,
  );
  let userId = normalizeAlbumUploadPersistenceUserId(recoveredAuthState?.user?.id || userIdHint);

  if (!userId && accessToken) {
    userId = normalizeAlbumUploadPersistenceUserId(
      (await supabase.auth.getUser(accessToken).catch(() => null))?.data.user?.id || userIdHint,
    );
  }

  if (!accessToken || !userId) {
    return null;
  }

  return {
    accessToken,
    client: createSupabaseAccessTokenClient(accessToken),
    userId,
  };
}

async function readAlbumUploadCapabilities(client: AlbumUploadClient, eventId: string) {
  const result = await client.rpc("get_event_capabilities", {
    target_event_id: eventId,
  });
  if (result.error) {
    return null;
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return (row || null) as EventUploadCapabilitiesRow | null;
}

export async function refreshAlbumUploadSession() {
  const refresh = await refreshSupabaseSessionSingleFlight().catch(() => null);
  return Boolean(refresh?.data?.session?.access_token);
}

async function getAlbumUploadAvailabilityWithClient(
  eventId: string,
  userId: string,
  client: AlbumUploadClient,
): Promise<AlbumUploadAvailability> {
  const normalizedEventId = String(eventId || "").trim();
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedEventId) {
    throw new Error("Etkinlik bulunamadi.");
  }
  if (!normalizedUserId) {
    throw new Error("Oturum doğrulanamadı.");
  }

  const [{ data: eventRow, error: eventError }, capabilities, ownAlbumsRes] = await Promise.all([
    client
      .from("events")
      .select("id,club_id")
      .eq("id", normalizedEventId)
      .is("deleted_at", null)
      .maybeSingle(),
    readAlbumUploadCapabilities(client, normalizedEventId),
    client
      .from("album_photos")
      .select("id")
      .eq("event_id", normalizedEventId)
      .eq("user_id", normalizedUserId)
      .is("deleted_at", null),
  ]);

  if (eventError || !eventRow) {
    throw new Error("Etkinlik bulunamadi.");
  }
  if (ownAlbumsRes.error) {
    throw new Error("Albüm yükleme hakkı hesaplanamadı.");
  }

  const isOwnerClub = String(eventRow.club_id || "").trim() === normalizedUserId;
  const capabilityAllowsUpload = capabilities?.can_upload_event_album === true;
  let isParticipant = capabilityAllowsUpload && !isOwnerClub;

  if (!capabilities && !isOwnerClub) {
    const { data: attendeeRow, error: attendeeError } = await client
      .from("event_attendees")
      .select("event_id")
      .eq("event_id", normalizedEventId)
      .eq("user_id", normalizedUserId)
      .maybeSingle();
    if (attendeeError) {
      throw new Error("Albüm yükleme yetkisi doğrulanamadı.");
    }
    isParticipant = Boolean(attendeeRow);
  }

  const ownAlbumCount = Math.max(0, ownAlbumsRes.data?.length || 0);
  const remainingAlbumSlots = Math.max(0, MAX_EVENT_ALBUM_CARDS - ownAlbumCount);

  if (capabilities && !capabilityAllowsUpload) {
    return {
      canUpload: false,
      isOwnerClub,
      isParticipant: false,
      ownAlbumCount,
      remainingAlbumSlots,
      reason:
        resolveAlbumUploadCapabilityReason(capabilities) ||
        "Bu albüme sadece etkinlik sahibi kulüp ve katılımcılar medya yükleyebilir.",
    };
  }

  if (!isOwnerClub && !isParticipant) {
    return {
      canUpload: false,
      isOwnerClub,
      isParticipant,
      ownAlbumCount,
      remainingAlbumSlots,
      reason: "Bu albüme sadece etkinlik sahibi kulüp ve katılımcılar medya yükleyebilir.",
    };
  }

  if (remainingAlbumSlots <= 0) {
    return {
      canUpload: false,
      isOwnerClub,
      isParticipant,
      ownAlbumCount,
      remainingAlbumSlots,
      reason: "Her kullanıcı bu etkinliğe en fazla 3 albüm kartı ekleyebilir.",
    };
  }

  return {
    canUpload: true,
    isOwnerClub,
    isParticipant,
    ownAlbumCount,
    remainingAlbumSlots,
    reason: null,
  };
}

export async function getAlbumUploadAvailabilityForAuthContext(
  eventId: string,
  authContext: AlbumUploadAuthContext,
) {
  return getAlbumUploadAvailabilityWithClient(eventId, authContext.userId, authContext.client);
}

export async function getAlbumUploadAvailability(
  eventId: string,
  userId: string,
): Promise<AlbumUploadAvailability> {
  const authContext = await readAlbumUploadAuthContext({
    userIdHint: userId,
  });
  if (!authContext) {
    throw new Error("Oturum doğrulanamadı.");
  }
  return getAlbumUploadAvailabilityWithClient(eventId, authContext.userId, authContext.client);
}

export async function ensureAlbumUploadAllowedForAuthContext(
  eventId: string,
  authContext: AlbumUploadAuthContext,
) {
  const availability = await getAlbumUploadAvailabilityForAuthContext(eventId, authContext);
  if (!availability.canUpload) {
    throw new Error(availability.reason || "Bu etkinlik albümüne fotoğraf yükleme yetkiniz yok.");
  }
  return availability;
}

export async function ensureAlbumUploadAllowed(eventId: string, userId: string) {
  const availability = await getAlbumUploadAvailability(eventId, userId);
  if (!availability.canUpload) {
    throw new Error(availability.reason || "Bu etkinlik albümüne fotoğraf yükleme yetkiniz yok.");
  }
  return availability;
}

export async function finalizeAlbumUpload(item: AlbumPhotoWithMeta) {
  const [hydrated] = await hydrateAlbumOwnerProfiles([item]);
  const resolved = hydrated || item;
  await persistLocalAlbumShadow(resolved);
  return resolved;
}

export async function writeAlbumPhotoToTable(params: {
  client: AlbumUploadClient;
  payload: UploadPhotoPayload;
  userId: string;
}) {
  const nextImages = normalizeImages(params.payload);
  if (nextImages.length > MAX_EVENT_ALBUM_PHOTOS) {
    throw new Error("Tek bir albüm kartında en fazla 6 medya olabilir.");
  }

  const visibility = normalizeProfileSurfaceVisibility(params.payload);
  const surfaceVisibility = resolveAlbumSurfaceVisibility(visibility);
  const basePayload = {
    storage_path: nextImages[0],
    media_paths: nextImages,
    caption: params.payload.caption || "",
    title: params.payload.title || null,
    show_on_profile: surfaceVisibility.showOnOwnProfile || surfaceVisibility.showOnClubProfile,
    show_on_user_profile: surfaceVisibility.showOnOwnProfile,
    show_on_club_profile: surfaceVisibility.showOnClubProfile,
  };
  const clientMutationId = String(params.payload.clientMutationId || "").trim() || null;
  const { data, error } = await params.client.rpc("create_album_photo_with_patch", {
    client_mutation_id: clientMutationId,
    target_caption: basePayload.caption,
    target_event_id: params.payload.eventId,
    target_media_paths: basePayload.media_paths,
    target_show_on_club_profile: basePayload.show_on_club_profile,
    target_show_on_profile: basePayload.show_on_profile,
    target_show_on_user_profile: basePayload.show_on_user_profile,
    target_storage_path: basePayload.storage_path,
    target_title: basePayload.title,
  });
  if (error) throw error;
  const createdPhotoRow = Array.isArray(data) ? data[0] : data;
  const nextPhotoId = String(createdPhotoRow?.id || "").trim() || createAlbumPhotoId();
  const nextCreatedAt =
    String(createdPhotoRow?.created_at || "").trim() || new Date().toISOString();

  const [{ data: profile }, { data: eventRow }] = await Promise.all([
    params.client
      .from("profiles")
      .select("username,name,club_name,profile_image_path,university,is_private")
      .eq("user_id", params.userId)
      .is("deleted_at", null)
      .maybeSingle(),
    params.client
      .from("events")
      .select("club_id,visibility")
      .eq("id", params.payload.eventId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  const clubProfileRes = eventRow?.club_id
    ? await params.client
        .from("profiles")
        .select("username,club_name,is_private")
        .eq("user_id", String(eventRow.club_id || "").trim())
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  return {
    id: nextPhotoId,
    userId: params.userId,
    username: profile?.username || "",
    name: profile ? toDisplayName(profile) : "",
    userImage: profile?.profile_image_path || "",
    userUniversity: profile?.university || "",
    clubName: clubProfileRes.data ? toDisplayName(clubProfileRes.data) : undefined,
    eventId: params.payload.eventId,
    eventTitle: params.payload.eventTitle,
    image: String(createdPhotoRow?.storage_path || nextImages[0] || "").trim(),
    images:
      Array.isArray(createdPhotoRow?.media_paths) && createdPhotoRow.media_paths.length > 0
        ? createdPhotoRow.media_paths
            .map((item: unknown) => String(item || "").trim())
            .filter(Boolean)
        : nextImages,
    photoCount: nextImages.length || 1,
    caption: basePayload.caption || undefined,
    createdAt: nextCreatedAt,
    likes: 0,
    liked: false,
    comments: 0,
    title: basePayload.title || undefined,
    showOnOwnProfile: surfaceVisibility.showOnOwnProfile,
    showOnClubProfile: surfaceVisibility.showOnClubProfile,
    showOnProfile: surfaceVisibility.showOnProfile,
    surfaceVisibility,
    eventVisibility: eventRow?.visibility === "members_only" ? "members_only" : "public",
    effectiveVisibility: eventRow?.visibility === "members_only" ? "members_only" : "public",
    clubUserId: String(eventRow?.club_id || "").trim() || undefined,
    clubUsername: String(clubProfileRes.data?.username || "").trim() || undefined,
    clubIsPrivate: false,
    uploaderIsPrivate: Boolean(profile?.is_private),
    viewerJoinedEvent: true,
  } satisfies AlbumPhotoWithMeta;
}

export async function ensureServerAlbumInSql(params: {
  client: AlbumUploadClient;
  created: AlbumPhotoWithMeta;
  payload: UploadPhotoPayload;
  userId: string;
}) {
  const expectedImages = normalizeImages(params.payload);
  const expectedVisibility = normalizeProfileSurfaceVisibility(params.payload);
  const persistedRes = await params.client
    .from("album_photos")
    .select("id,media_paths,storage_path,show_on_profile,show_on_user_profile,show_on_club_profile")
    .eq("id", String(params.created.id || "").trim())
    .is("deleted_at", null)
    .maybeSingle();

  const persistedImages =
    Array.isArray(persistedRes.data?.media_paths) && persistedRes.data.media_paths.length > 0
      ? persistedRes.data.media_paths.map((item) => String(item || "").trim()).filter(Boolean)
      : persistedRes.data?.storage_path
        ? [String(persistedRes.data.storage_path).trim()]
        : [];
  const hasExactPersistedImages =
    expectedImages.length > 0 &&
    persistedImages.length === expectedImages.length &&
    expectedImages.every((item) => persistedImages.includes(String(item || "").trim()));

  if (!persistedRes.data?.id || !hasExactPersistedImages) {
    return writeAlbumPhotoToTable({
      client: params.client,
      payload: params.payload,
      userId: params.userId,
    });
  }

  const persistedShowOnOwnProfile = Boolean(
    persistedRes.data.show_on_user_profile ?? persistedRes.data.show_on_profile,
  );
  const persistedShowOnClubProfile = Boolean(persistedRes.data.show_on_club_profile);
  const persistedShowOnProfile = Boolean(persistedRes.data.show_on_profile);
  const nextShowOnProfile =
    expectedVisibility.showOnOwnProfile || expectedVisibility.showOnClubProfile;

  if (
    persistedShowOnOwnProfile !== expectedVisibility.showOnOwnProfile ||
    persistedShowOnClubProfile !== expectedVisibility.showOnClubProfile ||
    persistedShowOnProfile !== nextShowOnProfile
  ) {
    await params.client
      .from("album_photos")
      .update({
        show_on_club_profile: expectedVisibility.showOnClubProfile,
        show_on_profile: nextShowOnProfile,
        show_on_user_profile: expectedVisibility.showOnOwnProfile,
      })
      .eq("id", String(persistedRes.data.id || "").trim())
      .is("deleted_at", null);
  }

  return {
    ...params.created,
    showOnOwnProfile: expectedVisibility.showOnOwnProfile,
    showOnClubProfile: expectedVisibility.showOnClubProfile,
    showOnProfile: nextShowOnProfile,
    surfaceVisibility: resolveAlbumSurfaceVisibility({
      showOnClubProfile: expectedVisibility.showOnClubProfile,
      showOnOwnProfile: expectedVisibility.showOnOwnProfile,
      showOnProfile: nextShowOnProfile,
    }),
  };
}
