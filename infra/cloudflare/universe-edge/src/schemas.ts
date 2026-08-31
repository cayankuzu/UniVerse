import { z } from "zod";

const USERNAME = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/);
const EMAIL = z.string().trim().toLowerCase().email().max(160);
const ID = z.string().trim().min(1).max(120);
const OPTIONAL_TEXT = (max: number) => z.string().trim().max(max).optional();
const CATEGORIES = z.array(z.string().trim().min(1).max(40)).max(8).optional();

const profileFields = {
  accountType: z.enum(["student", "club"]),
  bio: OPTIONAL_TEXT(150),
  categories: CATEGORIES,
  clubName: OPTIONAL_TEXT(80),
  coverImage: OPTIONAL_TEXT(512),
  department: OPTIONAL_TEXT(80),
  description: OPTIONAL_TEXT(200),
  email: EMAIL,
  gradeYear: OPTIONAL_TEXT(40),
  isPrivate: z.boolean().optional(),
  name: OPTIONAL_TEXT(80),
  profileImage: OPTIONAL_TEXT(512),
  university: z.string().trim().min(1).max(120),
  username: USERNAME,
};

export const registerDirectSchema = z.object({
  ...profileFields,
  existingUserId: ID,
  registrationNonce: z.string().trim().min(16).max(160),
});

export const registerSchema = z.object({
  ...profileFields,
  categories: z.array(z.string().trim().min(1).max(40)).max(8),
  isPrivate: z.boolean(),
});

export const reportSchema = z.object({
  clientMutationId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._:-]{8,120}$/)
    .optional(),
  detail: OPTIONAL_TEXT(1000),
  reason: z.string().trim().min(1).max(240),
  targetId: ID,
  targetType: z.enum(["album", "album_comment", "event", "event_comment", "user"]),
  targetUsername: OPTIONAL_TEXT(120),
});

const uploadSessionItemSchema = z.object({
  checksum: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i),
  contentType: z.string().trim().min(1).max(120),
  expectedSizeBytes: z
    .number()
    .int()
    .positive()
    .max(220 * 1024 * 1024),
  mediaIndex: z.number().int().min(0).max(5),
  sourceName: z.string().trim().min(1).max(240),
});

export const uploadSessionCreateSchema = z.object({
  folder: z.string().trim().min(1).max(32),
  items: z.array(uploadSessionItemSchema).min(1).max(6),
  mutationId: ID,
});

export const uploadSessionIdSchema = z.object({
  sessionId: z.string().uuid(),
});

export type ValidatedBody =
  | z.infer<typeof registerDirectSchema>
  | z.infer<typeof registerSchema>
  | z.infer<typeof reportSchema>
  | z.infer<typeof uploadSessionCreateSchema>
  | z.infer<typeof uploadSessionIdSchema>;
