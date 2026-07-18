import * as kv from "../kv_store.ts";
import { logError } from "../logging.ts";
import { removePhotoFromKv, sweepNotificationsByTarget } from "./contentCleanup.ts";
import type {
  KvAlbumPhotoRecord,
  KvBooleanRecord,
  KvCommentRecord,
  ServerRouteDeps,
} from "../types.ts";
import { enforceCompatMutationRateLimit } from "./compatMutationRateLimit.ts";
import {
  parseAlbumCreateBody,
  parseAlbumSyncBody,
  parsePhotoParams,
} from "./compatRouteValidation.ts";
import type {
  AlbumRouteApp,
  AlbumRouteContextFactory,
  DbAlbumPhotoRow,
  DbEventRow,
} from "./albumsRouteContext.ts";
import {
  normalizeAlbumSurfaceVisibility,
  normalizeDbPhotoImages,
  toRouteError,
} from "./albumsRouteContext.ts";
import { normalizeKvPhotoImages } from "./albumRouteHelpers.ts";
import { resolveCompatProfilePrivacy } from "./compatProfilePrivacy.ts";
import { STORAGE_BUCKET } from "./storagePolicy.ts";
import { isSqlBlockedPair } from "../services/sqlBlockedState.ts";

const ALBUM_TOGGLE_WINDOW_MS = 60_000;
const ALBUM_TOGGLE_USER_LIMIT = 60;
const ALBUM_TOGGLE_IP_LIMIT = 120;
const ALBUM_WRITE_WINDOW_MS = 10 * 60_000;
const ALBUM_WRITE_USER_LIMIT = 6;
const ALBUM_WRITE_IP_LIMIT = 12;

function normalizeStoragePaths(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

type AlbumMutationRouteDeps = Pick<
  ServerRouteDeps,
  "adminSupabase" | "generateId" | "getUser" | "loadCanonicalProfile"
>;

export function registerAlbumMutationRoutes(
  app: AlbumRouteApp,
  deps: AlbumMutationRouteDeps,
  createAlbumRequestContext: AlbumRouteContextFactory,
) {
  const { adminSupabase, generateId, getUser, loadCanonicalProfile } = deps;

  app.post("/make-server-e3557d40/albums", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: ALBUM_WRITE_IP_LIMIT,
      scope: "compat:albums:create",
      userId: user.id,
      userLimit: ALBUM_WRITE_USER_LIMIT,
      windowMs: ALBUM_WRITE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const routeContext = createAlbumRequestContext();
      const body = parseAlbumCreateBody(await c.req.json().catch(() => ({})));
      const eventId = String(body.eventId || body.event_id || "").trim();
      const uploadAccess = await routeContext.canUploadAlbumToEvent(user.id, eventId);
      if (!uploadAccess.allowed) {
        return c.json({ error: uploadAccess.reason }, 403);
      }

      const profile = await loadCanonicalProfile(user);
      if (!profile) return c.json({ error: "Profile not found" }, 404);

      const incomingImages =
        Array.isArray(body.images) && body.images.length > 0
          ? body.images.map((item) => String(item || "").trim()).filter(Boolean)
          : body.image
            ? [String(body.image).trim()]
            : [];
      if (!incomingImages.length) {
        return c.json({ error: "Fotograf secilmedi" }, 400);
      }
      if (incomingImages.length > 9) {
        return c.json({ error: "Tek bir album kartinda en fazla 9 medya olabilir." }, 400);
      }

      const [photos, eventRes, ownAlbumRowsRes] = await Promise.all([
        kv.get<KvAlbumPhotoRecord[]>(`photos:${user.id}`).then((value) => value || []),
        adminSupabase
          .from("events")
          .select("id,title,visibility,club_id")
          .eq("id", eventId)
          .maybeSingle(),
        adminSupabase
          .from("album_photos")
          .select("media_paths,storage_path")
          .eq("event_id", eventId)
          .eq("user_id", user.id),
      ]);
      const ownAlbumRows = Array.isArray(ownAlbumRowsRes.data)
        ? (ownAlbumRowsRes.data as DbAlbumPhotoRow[])
        : [];
      const ownAlbumCount = ownAlbumRows.length;
      const remainingSlots = Math.max(0, 3 - ownAlbumCount);
      if (remainingSlots <= 0) {
        return c.json(
          {
            error: "Her kullanici bu etkinlige en fazla 3 album karti ekleyebilir.",
          },
          400,
        );
      }

      const createdAt = new Date().toISOString();
      const sqlPhotoId = generateId();
      const visibility = normalizeAlbumSurfaceVisibility(body);
      const basePayload = {
        caption: String(body.caption || "").trim(),
        media_paths: incomingImages,
        show_on_club_profile: visibility.showOnClubProfile,
        show_on_profile: visibility.showOnOwnProfile || visibility.showOnClubProfile,
        show_on_user_profile: visibility.showOnOwnProfile,
        storage_path: incomingImages[0],
        title: String(body.title || "").trim() || null,
      };
      const writeRes = await adminSupabase
        .from("album_photos")
        .insert({
          id: sqlPhotoId,
          created_at: createdAt,
          event_id: eventId,
          user_id: user.id,
          ...basePayload,
        })
        .select(
          "id,event_id,user_id,storage_path,media_paths,caption,title,show_on_profile,show_on_user_profile,show_on_club_profile,created_at",
        )
        .single();

      if (writeRes.error || !writeRes.data) {
        logError("albums/create", "album-create-insert-failed", writeRes.error, {
          userId: user.id,
        });
        return c.json({ error: "Album kaydi olusturulamadi" }, 500);
      }

      const writtenPhoto = writeRes.data as DbAlbumPhotoRow;
      const eventRow = eventRes.data as DbEventRow | null;
      const photo: KvAlbumPhotoRecord = {
        id: writtenPhoto.id,
        userId: user.id,
        username: profile.username || "",
        name: profile.name || profile.clubName || "",
        userImage: profile.profileImage || "",
        userUniversity: profile.university || "",
        eventId,
        eventTitle: String(eventRow?.title || "").trim(),
        image: writtenPhoto.storage_path || incomingImages[0],
        images: normalizeDbPhotoImages(writtenPhoto),
        createdAt: writtenPhoto.created_at || createdAt,
        caption: writtenPhoto.caption || undefined,
        title: writtenPhoto.title || undefined,
        showOnClubProfile: Boolean(writtenPhoto.show_on_club_profile),
        showOnOwnProfile: Boolean(
          writtenPhoto.show_on_user_profile ?? writtenPhoto.show_on_profile,
        ),
        showOnProfile: Boolean(writtenPhoto.show_on_profile),
      };

      await kv.set(
        `photolikes:${photo.id}`,
        (await kv.get<KvBooleanRecord>(`photolikes:${photo.id}`)) || {},
      );
      await kv.set(
        `photocomments:${photo.id}`,
        (await kv.get<KvCommentRecord[]>(`photocomments:${photo.id}`)) || [],
      );
      photos.unshift(photo);
      await kv.set(`photos:${user.id}`, photos);

      return c.json({
        ...photo,
        clubIsPrivate: false,
        clubUserId: String(eventRow?.club_id || "").trim() || undefined,
        clubUsername: undefined,
        comments: 0,
        effectiveVisibility: "public",
        eventVisibility: "public",
        liked: false,
        likes: 0,
        photoCount: photo.images?.length || 1,
        showOnClubProfile: Boolean(writtenPhoto.show_on_club_profile),
        showOnOwnProfile: Boolean(
          writtenPhoto.show_on_user_profile ?? writtenPhoto.show_on_profile,
        ),
        showOnProfile: Boolean(writtenPhoto.show_on_profile),
        uploaderIsPrivate: resolveCompatProfilePrivacy(profile.accountType, profile.isPrivate),
      });
    } catch (error) {
      const routeError = toRouteError(error, "Album kaydi olusturulamadi.");
      if (routeError.status >= 500) {
        logError("albums/create", "album-create-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/albums/sync", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: ALBUM_WRITE_IP_LIMIT,
      scope: "compat:albums:sync",
      userId: user.id,
      userLimit: ALBUM_WRITE_USER_LIMIT,
      windowMs: ALBUM_WRITE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const routeContext = createAlbumRequestContext();
      const body = parseAlbumSyncBody(await c.req.json().catch(() => ({})));
      const eventIds = Array.isArray(body.eventIds)
        ? body.eventIds.map((item) => String(item || "").trim()).filter(Boolean)
        : body.eventId
          ? [String(body.eventId).trim()]
          : [];
      const synced = await routeContext.syncKvPhotosToSql(eventIds);
      return c.json({ eventIds, synced });
    } catch (error) {
      const routeError = toRouteError(error, "Album senkronize edilemedi.");
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.post("/make-server-e3557d40/albums/:photoId/like", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: ALBUM_TOGGLE_IP_LIMIT,
      scope: "compat:albums:like",
      userId: user.id,
      userLimit: ALBUM_TOGGLE_USER_LIMIT,
      windowMs: ALBUM_TOGGLE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const { photoId } = parsePhotoParams({
        photoId: c.req.param("photoId"),
      });
      const { data: photoRow, error: photoError } = await adminSupabase
        .from("album_photos")
        .select("id,user_id,event_id")
        .eq("id", photoId)
        .maybeSingle();
      if (photoError) {
        throw new Error(photoError.message);
      }
      if (!photoRow?.id) {
        return c.json({ error: "Album bulunamadi." }, 404);
      }

      const eventId = String(photoRow.event_id || "").trim();
      const { data: eventRow, error: eventError } = eventId
        ? await adminSupabase.from("events").select("id,club_id").eq("id", eventId).maybeSingle()
        : { data: null, error: null };
      if (eventError) {
        throw new Error(eventError.message);
      }

      if (
        (await isSqlBlockedPair(adminSupabase, user.id, String(photoRow.user_id || ""))) ||
        (await isSqlBlockedPair(adminSupabase, user.id, String(eventRow?.club_id || "")))
      ) {
        return c.json({ error: "Bu albumle etkilesim kuramazsiniz." }, 403);
      }
      const likes = await kv
        .get<KvBooleanRecord>(`photolikes:${photoId}`)
        .then((value) => value || {});
      const wasLiked = Boolean(likes[user.id]);
      if (wasLiked) {
        delete likes[user.id];
      } else {
        likes[user.id] = true;
      }
      await kv.set(`photolikes:${photoId}`, likes);
      return c.json({ liked: !wasLiked, count: Object.values(likes).filter(Boolean).length });
    } catch (error) {
      const routeError = toRouteError(error, "Begeni guncellenemedi.");
      return c.json({ error: routeError.message }, routeError.status);
    }
  });

  app.delete("/make-server-e3557d40/albums/:photoId", async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rateLimitResponse = await enforceCompatMutationRateLimit({
      c,
      ipLimit: ALBUM_WRITE_IP_LIMIT,
      scope: "compat:albums:delete",
      userId: user.id,
      userLimit: ALBUM_WRITE_USER_LIMIT,
      windowMs: ALBUM_WRITE_WINDOW_MS,
    });
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const routeContext = createAlbumRequestContext();
      const { photoId } = parsePhotoParams({
        photoId: c.req.param("photoId"),
      });
      const context = await routeContext.getPhotoModerationContext(photoId);
      if (!context) return c.json({ error: "Album bulunamadi" }, 404);
      if (!routeContext.canDeletePhotoContent(user.id, context.photoUserId, context.clubUserId)) {
        return c.json({ error: "Bu albumu silme yetkiniz yok." }, 403);
      }
      const mediaPaths = normalizeStoragePaths(normalizeKvPhotoImages(context.kvPhoto));

      const { error } = await adminSupabase.from("album_photos").delete().eq("id", photoId);
      if (
        error &&
        !String(error.message || "")
          .toLowerCase()
          .includes("no rows")
      ) {
        logError("albums/delete", "album-delete-provider-failed", error, {
          photoId,
          userId: user.id,
        });
        return c.json({ error: "Album silinemedi." }, 500);
      }

      if (mediaPaths.length > 0) {
        await adminSupabase.storage
          .from(STORAGE_BUCKET)
          .remove(mediaPaths)
          .catch(() => null);
        const { error: mediaAssetError } = await adminSupabase
          .from("media_assets")
          .delete()
          .in("object_path", mediaPaths);
        if (mediaAssetError) {
          logError("albums/delete", "album-delete-media-cleanup-failed", mediaAssetError, {
            mediaPaths,
            photoId,
            userId: user.id,
          });
        }
      }

      await removePhotoFromKv(photoId);
      await sweepNotificationsByTarget({ photoId, eventId: context.eventId });
      return c.json({ success: true });
    } catch (error) {
      const routeError = toRouteError(error, "Album silinemedi.");
      if (routeError.status >= 500) {
        logError("albums/delete", "album-delete-failed", error, { userId: user.id });
      }
      return c.json({ error: routeError.message }, routeError.status);
    }
  });
}
