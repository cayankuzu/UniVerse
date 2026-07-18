import { z } from "npm:zod";

export class DiscoveryRouteValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DiscoveryRouteValidationError";
    this.status = status;
  }
}

const REPORT_TARGET_TYPES = ["album", "album_comment", "event", "event_comment", "user"] as const;
const SEARCH_TYPES = ["events", "clubs", "students"] as const;

const reportBodySchema = z.object({
  detail: z.string().trim().max(1000, "Detay en fazla 1000 karakter olabilir").optional(),
  reason: z
    .string()
    .trim()
    .min(1, "reason zorunludur")
    .max(240, "reason en fazla 240 karakter olabilir"),
  targetId: z.string().trim().min(1, "targetId zorunludur").max(120, "targetId gecersiz"),
  targetType: z.enum(REPORT_TARGET_TYPES, {
    errorMap: () => ({ message: "Gecersiz sikayet hedefi" }),
  }),
  targetUsername: z.string().trim().max(120, "targetUsername gecersiz").optional(),
});

const signedUrlBodySchema = z.object({
  path: z.string().trim().min(1, "Path gerekli").max(512, "Path gecersiz"),
});

const signedUploadTicketBodySchema = z.object({
  contentType: z.string().trim().min(1, "contentType gerekli").max(120, "contentType gecersiz"),
  folder: z.string().trim().min(1, "folder gerekli").max(32, "folder gecersiz"),
  sourceName: z.string().trim().min(1, "sourceName gerekli").max(240, "sourceName gecersiz"),
  uploadKey: z.string().trim().max(120, "uploadKey gecersiz").optional(),
});

const signedUploadConfirmBodySchema = z.object({
  contentType: z.string().trim().min(1, "contentType gerekli").max(120, "contentType gecersiz"),
  path: z.string().trim().min(1, "Path gerekli").max(512, "Path gecersiz"),
});

const uploadSessionItemSchema = z.object({
  checksum: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "checksum gecersiz"),
  contentType: z.string().trim().min(1, "contentType gerekli").max(120, "contentType gecersiz"),
  expectedSizeBytes: z
    .number()
    .int()
    .positive()
    .max(220 * 1024 * 1024),
  mediaIndex: z.number().int().min(0).max(8),
  sourceName: z.string().trim().min(1, "sourceName gerekli").max(240, "sourceName gecersiz"),
});

const uploadSessionCreateBodySchema = z.object({
  folder: z.string().trim().min(1, "folder gerekli").max(32, "folder gecersiz"),
  items: z
    .array(uploadSessionItemSchema)
    .min(1, "En az bir medya gerekli")
    .max(9, "En fazla 9 medya olabilir"),
  mutationId: z.string().trim().min(1, "mutationId gerekli").max(120, "mutationId gecersiz"),
});

const uploadSessionIdBodySchema = z.object({
  sessionId: z.string().uuid("sessionId gecersiz"),
});

const searchQuerySchema = z.object({
  category: z.string().trim().max(40, "Kategori en fazla 40 karakter olabilir").optional(),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      const parsed = Number(value || 20);
      if (!Number.isFinite(parsed) || parsed <= 0) return 20;
      return Math.min(Math.floor(parsed), 50);
    }),
  q: z
    .string()
    .trim()
    .max(80, "Arama en fazla 80 karakter olabilir")
    .transform((value) => value.toLowerCase())
    .default(""),
  type: z.enum(SEARCH_TYPES).default("events"),
  university: z.string().trim().max(120, "Universite en fazla 120 karakter olabilir").optional(),
});

function parseWithSchema<T>(schema: z.ZodSchema<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const firstIssue = result.error.issues[0];
  throw new DiscoveryRouteValidationError(firstIssue?.message || "Gecersiz istek", 400);
}

export function parseReportRequestBody(body: unknown) {
  return parseWithSchema(reportBodySchema, body);
}

export function parseSignedUrlRequestBody(body: unknown) {
  return parseWithSchema(signedUrlBodySchema, body);
}

export function parseSignedUploadTicketRequestBody(body: unknown) {
  return parseWithSchema(signedUploadTicketBodySchema, body);
}

export function parseSignedUploadConfirmRequestBody(body: unknown) {
  return parseWithSchema(signedUploadConfirmBodySchema, body);
}

export function parseUploadSessionCreateRequestBody(body: unknown) {
  return parseWithSchema(uploadSessionCreateBodySchema, body);
}

export function parseUploadSessionIdRequestBody(body: unknown) {
  return parseWithSchema(uploadSessionIdBodySchema, body);
}

export function parseSearchRequestQuery(query: unknown) {
  return parseWithSchema(searchQuerySchema, query);
}
