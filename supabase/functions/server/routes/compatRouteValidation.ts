import { z } from "npm:zod";

export class CompatRouteValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CompatRouteValidationError";
    this.status = status;
  }
}

const USERNAME_REGEX = /^[a-z0-9_]+$/;
const EVENT_FEED_FILTERS = ["all", "following", "myEvents", "own"] as const;

const trimmedTextField = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

const requiredTextField = (max: number, requiredMessage: string, maxMessage: string) =>
  z.string().trim().min(1, requiredMessage).max(max, maxMessage);

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Kullanici adi gecersiz")
  .max(24, "Kullanici adi gecersiz")
  .regex(USERNAME_REGEX, "Kullanici adi gecersiz");

const idField = (message: string) => z.string().trim().min(1, message).max(120, message);

const optionalIdField = (message: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return undefined;
      if (normalized.length > 120) {
        throw new CompatRouteValidationError(message, 400);
      }
      return normalized;
    });

const stringArrayField = (maxItems: number, maxItemLength: number, fieldName: string) =>
  z
    .array(
      z
        .string()
        .trim()
        .min(1, `${fieldName} bos olamaz`)
        .max(maxItemLength, `${fieldName} gecersiz`),
    )
    .max(maxItems, `${fieldName} sayisi limiti asildi`)
    .optional();

const usernameParamsSchema = z.object({
  username: usernameField,
});

const eventFeedQuerySchema = z.object({
  filter: z.enum(EVENT_FEED_FILTERS).optional().default("following"),
});

const notificationParamsSchema = z.object({
  id: idField("Bildirim id gecersiz"),
});

const eventParamsSchema = z.object({
  id: idField("Etkinlik id gecersiz"),
});

const eventIdParamsSchema = z.object({
  eventId: idField("Etkinlik id gecersiz"),
});

const photoParamsSchema = z.object({
  photoId: idField("Album id gecersiz"),
});

const photoCommentParamsSchema = z.object({
  commentId: idField("Yorum id gecersiz"),
  photoId: idField("Album id gecersiz"),
});

const eventCommentParamsSchema = z.object({
  commentId: idField("Yorum id gecersiz"),
  id: idField("Etkinlik id gecersiz"),
});

const commentBodySchema = z.object({
  parentId: optionalIdField("Yorum referansi gecersiz"),
  text: requiredTextField(1000, "Yorum bos olamaz", "Yorum en fazla 1000 karakter olabilir"),
});

const eventCreateBodySchema = z
  .object({
    access: trimmedTextField(40, "Erisim bilgisi en fazla 40 karakter olabilir"),
    address: trimmedTextField(160, "Adres en fazla 160 karakter olabilir"),
    capacity: z
      .union([z.number(), z.string()])
      .optional()
      .transform((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50000) {
          throw new CompatRouteValidationError("Kapasite gecersiz", 400);
        }
        return Math.floor(parsed);
      }),
    categories: stringArrayField(8, 40, "Kategori"),
    category: trimmedTextField(40, "Kategori en fazla 40 karakter olabilir"),
    date: trimmedTextField(40, "Tarih gecersiz"),
    description: trimmedTextField(2000, "Aciklama en fazla 2000 karakter olabilir"),
    endDate: trimmedTextField(40, "Bitis tarihi gecersiz"),
    endTime: trimmedTextField(20, "Bitis saati gecersiz"),
    fee: trimmedTextField(40, "Ucret bilgisi en fazla 40 karakter olabilir"),
    image: trimmedTextField(512, "Gorsel yolu gecersiz"),
    level: trimmedTextField(40, "Seviye bilgisi en fazla 40 karakter olabilir"),
    location: trimmedTextField(160, "Konum en fazla 160 karakter olabilir"),
    materials: trimmedTextField(400, "Materyal bilgisi en fazla 400 karakter olabilir"),
    startDate: trimmedTextField(40, "Baslangic tarihi gecersiz"),
    startTime: trimmedTextField(20, "Baslangic saati gecersiz"),
    targetAudience: trimmedTextField(120, "Hedef kitle en fazla 120 karakter olabilir"),
    title: requiredTextField(120, "Baslik zorunludur", "Baslik en fazla 120 karakter olabilir"),
    type: trimmedTextField(40, "Tur bilgisi en fazla 40 karakter olabilir"),
  })
  .passthrough();

const albumCreateBodySchema = z
  .object({
    caption: trimmedTextField(600, "Aciklama en fazla 600 karakter olabilir"),
    eventId: trimmedTextField(120, "Etkinlik id gecersiz"),
    event_id: trimmedTextField(120, "Etkinlik id gecersiz"),
    image: trimmedTextField(512, "Gorsel yolu gecersiz"),
    images: stringArrayField(9, 512, "Gorsel"),
    showOnClubProfile: z.boolean().optional(),
    showOnOwnProfile: z.boolean().optional(),
    showOnProfile: z.boolean().optional(),
    show_on_club_profile: z.boolean().optional(),
    show_on_profile: z.boolean().optional(),
    show_on_user_profile: z.boolean().optional(),
    title: trimmedTextField(120, "Baslik en fazla 120 karakter olabilir"),
  })
  .passthrough()
  .superRefine((value, context) => {
    const eventId = String(value.eventId || value.event_id || "").trim();
    const images = Array.isArray(value.images)
      ? value.images.filter(Boolean)
      : value.image
        ? [value.image]
        : [];

    if (!eventId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Etkinlik id zorunludur",
        path: ["eventId"],
      });
    }
    if (images.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "En az bir gorsel gerekli",
        path: ["images"],
      });
    }
  });

const albumSyncBodySchema = z.object({
  eventId: trimmedTextField(120, "Etkinlik id gecersiz"),
  eventIds: stringArrayField(50, 120, "Etkinlik id"),
});

function parseWithSchema<T>(schema: z.ZodSchema<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const firstIssue = result.error.issues[0];
  throw new CompatRouteValidationError(firstIssue?.message || "Gecersiz istek", 400);
}

export function parseUsernameParams(value: unknown) {
  return parseWithSchema(usernameParamsSchema, value);
}

export function parseNotificationParams(value: unknown) {
  return parseWithSchema(notificationParamsSchema, value);
}

export function parseEventParams(value: unknown) {
  return parseWithSchema(eventParamsSchema, value);
}

export function parseEventIdParams(value: unknown) {
  return parseWithSchema(eventIdParamsSchema, value);
}

export function parsePhotoParams(value: unknown) {
  return parseWithSchema(photoParamsSchema, value);
}

export function parsePhotoCommentParams(value: unknown) {
  return parseWithSchema(photoCommentParamsSchema, value);
}

export function parseEventCommentParams(value: unknown) {
  return parseWithSchema(eventCommentParamsSchema, value);
}

export function parseCommentBody(value: unknown) {
  return parseWithSchema(commentBodySchema, value);
}

export function parseEventFeedQuery(value: unknown) {
  return parseWithSchema(eventFeedQuerySchema, value);
}

export function parseEventCreateBody(value: unknown) {
  return parseWithSchema(eventCreateBodySchema, value);
}

export function parseAlbumCreateBody(value: unknown) {
  return parseWithSchema(albumCreateBodySchema, value);
}

export function parseAlbumSyncBody(value: unknown) {
  return parseWithSchema(albumSyncBodySchema, value);
}
