import { z } from "npm:zod";
import {
  isPasswordPolicySatisfied,
  PASSWORD_POLICY as SHARED_PASSWORD_POLICY,
} from "../../../../src/mobile/app/shared/security/passwordPolicy.ts";
import { TEXT_LIMITS } from "../../../../src/mobile/app/shared/validation/textLimits.ts";

export class AuthRouteValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthRouteValidationError";
    this.status = status;
  }
}

export const PASSWORD_POLICY = SHARED_PASSWORD_POLICY;
const AUTH_TEXT_LIMITS = TEXT_LIMITS.auth;
const CATEGORY_TEXT_LIMITS = TEXT_LIMITS.category;

type AccountType = "student" | "club";

export type ParsedRegisterBody = {
  email?: string;
  username?: string;
  accountType?: AccountType;
  name?: string;
  clubName?: string;
  university?: string;
  department?: string;
  gradeYear?: string;
  bio?: string;
  description?: string;
  profileImage?: string;
  coverImage?: string;
  categories?: string[];
  isPrivate?: boolean;
};

export type ParsedRegisterDirectBody = {
  email: string;
  username: string;
  accountType: AccountType;
  university: string;
  existingUserId?: string;
  registrationNonce?: string;
  name?: string;
  clubName?: string;
  department?: string;
  gradeYear?: string;
  bio?: string;
  description?: string;
  profileImage?: string;
  coverImage?: string;
  categories?: string[];
  isPrivate?: boolean;
};

export type ParsedProfileUpdateBody = Partial<
  ParsedRegisterBody & {
    hideEmail?: boolean;
  }
>;

export type ParsedPrivacyBody = {
  isPrivate: boolean;
};

export type ParsedRepairBody = {
  force: boolean;
};

export type ParsedEmailVerificationBypassBody = {
  email: string;
};

const textField = (max: number) =>
  z.string().trim().max(max, `Metin alani en fazla ${max} karakter olabilir`).optional();

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Kullanici adi en az 3 karakter olmali")
  .max(
    AUTH_TEXT_LIMITS.username,
    `Kullanici adi en fazla ${AUTH_TEXT_LIMITS.username} karakter olabilir`,
  )
  .regex(/^[a-z0-9_]+$/, "Kullanici adi gecersiz")
  .optional();

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Gecerli bir e-posta girin")
  .max(AUTH_TEXT_LIMITS.email, `E-posta en fazla ${AUTH_TEXT_LIMITS.email} karakter olabilir`)
  .optional();

const categoriesField = z
  .array(z.string().trim().min(1).max(CATEGORY_TEXT_LIMITS.label))
  .max(
    CATEGORY_TEXT_LIMITS.maxSelections,
    `En fazla ${CATEGORY_TEXT_LIMITS.maxSelections} kategori secilebilir`,
  )
  .optional();

const passwordField = z
  .string()
  .min(
    PASSWORD_POLICY.minLength,
    `Sifre ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} karakter olmali ve en az 1 kucuk harf, 1 buyuk harf, 1 rakam icermeli`,
  )
  .max(
    PASSWORD_POLICY.maxLength,
    `Sifre ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} karakter olmali ve en az 1 kucuk harf, 1 buyuk harf, 1 rakam icermeli`,
  )
  .refine(isPasswordPolicySatisfied, {
    message: `Sifre ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} karakter olmali ve en az 1 kucuk harf, 1 buyuk harf, 1 rakam icermeli`,
  });

const registerBodySchema = z.object({
  accountType: z.enum(["student", "club"]).optional(),
  bio: textField(AUTH_TEXT_LIMITS.bio),
  categories: categoriesField,
  clubName: textField(AUTH_TEXT_LIMITS.clubName),
  coverImage: textField(AUTH_TEXT_LIMITS.mediaPath),
  department: textField(AUTH_TEXT_LIMITS.department),
  description: textField(AUTH_TEXT_LIMITS.clubDescription),
  email: emailField,
  gradeYear: textField(AUTH_TEXT_LIMITS.gradeYear),
  isPrivate: z.boolean().optional(),
  name: textField(AUTH_TEXT_LIMITS.name),
  profileImage: textField(AUTH_TEXT_LIMITS.mediaPath),
  university: textField(AUTH_TEXT_LIMITS.university),
  username: usernameField,
});

const registerDirectBodySchema = z.object({
  accountType: z.enum(["student", "club"]),
  bio: textField(AUTH_TEXT_LIMITS.bio),
  categories: categoriesField,
  clubName: textField(AUTH_TEXT_LIMITS.clubName),
  coverImage: textField(AUTH_TEXT_LIMITS.mediaPath),
  department: textField(AUTH_TEXT_LIMITS.department),
  description: textField(AUTH_TEXT_LIMITS.clubDescription),
  email: emailField.unwrap(),
  existingUserId: textField(TEXT_LIMITS.common.id),
  gradeYear: textField(AUTH_TEXT_LIMITS.gradeYear),
  isPrivate: z.boolean().optional(),
  name: textField(AUTH_TEXT_LIMITS.name),
  profileImage: textField(AUTH_TEXT_LIMITS.mediaPath),
  registrationNonce: textField(AUTH_TEXT_LIMITS.registrationNonce),
  university: textField(AUTH_TEXT_LIMITS.university).unwrap(),
  username: usernameField.unwrap(),
});

const profileUpdateBodySchema = registerBodySchema.extend({
  hideEmail: z.boolean().optional(),
});

const privacyBodySchema = z.object({
  isPrivate: z.boolean({
    required_error: "isPrivate zorunlu",
    invalid_type_error: "isPrivate true/false olmali",
  }),
});

const repairBodySchema = z.object({
  force: z.boolean().optional().default(false),
});

const passwordBodySchema = z.object({
  password: passwordField,
});

const usernameParamSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Kullanici adi en az 3 karakter olmali")
    .max(
      AUTH_TEXT_LIMITS.username,
      `Kullanici adi en fazla ${AUTH_TEXT_LIMITS.username} karakter olabilir`,
    )
    .regex(/^[a-z0-9_]+$/, "Kullanici adi gecersiz"),
});

const emailQuerySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Gecerli bir e-posta girin")
    .max(AUTH_TEXT_LIMITS.email, `E-posta en fazla ${AUTH_TEXT_LIMITS.email} karakter olabilir`),
});

const emailVerificationBypassBodySchema = z.object({
  email: emailField.unwrap(),
});

function parseWithSchema<T>(schema: z.ZodSchema<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const firstIssue = result.error.issues[0];
  throw new AuthRouteValidationError(firstIssue?.message || "Gecersiz istek", 400);
}

export function parseRegisterRequestBody(value: unknown): ParsedRegisterBody {
  return parseWithSchema(registerBodySchema, value);
}

export function parseRegisterDirectRequestBody(value: unknown): ParsedRegisterDirectBody {
  return parseWithSchema(registerDirectBodySchema, value);
}

export function parseProfileUpdateRequestBody(value: unknown): ParsedProfileUpdateBody {
  return parseWithSchema(profileUpdateBodySchema, value);
}

export function parsePrivacyRequestBody(value: unknown): ParsedPrivacyBody {
  return parseWithSchema(privacyBodySchema, value);
}

export function parseRepairRequestBody(value: unknown): ParsedRepairBody {
  return parseWithSchema(repairBodySchema, value);
}

export function parsePasswordRequestBody(value: unknown) {
  return parseWithSchema(passwordBodySchema, value);
}

export function parseUsernameAvailabilityParams(value: unknown) {
  return parseWithSchema(usernameParamSchema, value);
}

export function parseEmailAvailabilityQuery(value: unknown) {
  return parseWithSchema(emailQuerySchema, value);
}

export function parseEmailVerificationBypassRequestBody(
  value: unknown,
): ParsedEmailVerificationBypassBody {
  return parseWithSchema(emailVerificationBypassBodySchema, value);
}
