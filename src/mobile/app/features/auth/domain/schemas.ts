import { z } from "zod";
import {
  isPasswordPolicySatisfied,
  PASSWORD_POLICY,
} from "../../../shared/security/passwordPolicy";
import { TEXT_LIMITS } from "../../../shared/validation/textLimits";
import { USERNAME_REGEX } from "./validation";

const STRONG_PASSWORD_MESSAGE = `Şifre ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} karakter olmalı ve en az 1 küçük harf, 1 büyük harf, 1 rakam içermeli`;
const AUTH_TEXT_LIMITS = TEXT_LIMITS.auth;

const emailSchema = z
  .string()
  .trim()
  .max(AUTH_TEXT_LIMITS.email, `E-posta en fazla ${AUTH_TEXT_LIMITS.email} karakter olabilir`)
  .email("Geçerli e-posta gir");

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, STRONG_PASSWORD_MESSAGE)
  .max(PASSWORD_POLICY.maxLength, STRONG_PASSWORD_MESSAGE)
  .refine(isPasswordPolicySatisfied, STRONG_PASSWORD_MESSAGE);

const confirmPasswordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, `Şifre en az ${PASSWORD_POLICY.minLength} karakter olmalı`);

export function withPasswordConfirmation<TShape extends z.ZodRawShape>(
  schema: z.ZodObject<TShape>,
) {
  return schema
    .extend({
      confirmPassword: confirmPasswordSchema,
    })
    .superRefine((value, context) => {
      const candidate = value as { password?: string; confirmPassword?: string };
      if (candidate.password !== candidate.confirmPassword) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Şifreler eşleşmiyor",
          path: ["confirmPassword"],
        });
      }
    });
}

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifre zorunlu"),
});

export const studentRegisterSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(AUTH_TEXT_LIMITS.bio, `Biyografi en fazla ${AUTH_TEXT_LIMITS.bio} karakter olabilir.`),
  name: z
    .string()
    .trim()
    .min(2, "Ad zorunlu")
    .max(AUTH_TEXT_LIMITS.name, `Ad en fazla ${AUTH_TEXT_LIMITS.name} karakter olabilir`),
  username: z
    .string()
    .min(3, "Kullanıcı adı en az 3 karakter")
    .max(
      AUTH_TEXT_LIMITS.username,
      `Kullanıcı adı en fazla ${AUTH_TEXT_LIMITS.username} karakter olabilir`,
    )
    .regex(USERNAME_REGEX, "Kullanıcı adı sadece küçük harf, rakam ve _ içerebilir"),
  email: emailSchema,
  password: strongPasswordSchema,
  university: z
    .string()
    .trim()
    .min(2, "Üniversite zorunlu")
    .max(
      AUTH_TEXT_LIMITS.university,
      `Üniversite en fazla ${AUTH_TEXT_LIMITS.university} karakter olabilir`,
    ),
  department: z
    .string()
    .trim()
    .max(
      AUTH_TEXT_LIMITS.department,
      `Bölüm en fazla ${AUTH_TEXT_LIMITS.department} karakter olabilir`,
    ),
  gradeYear: z
    .string()
    .trim()
    .max(
      AUTH_TEXT_LIMITS.gradeYear,
      `Sınıf bilgisi en fazla ${AUTH_TEXT_LIMITS.gradeYear} karakter olabilir`,
    ),
});

export const clubRegisterSchema = z.object({
  clubName: z
    .string()
    .trim()
    .min(2, "Kulüp adı zorunlu")
    .max(
      AUTH_TEXT_LIMITS.clubName,
      `Kulüp adı en fazla ${AUTH_TEXT_LIMITS.clubName} karakter olabilir`,
    ),
  username: z
    .string()
    .min(3, "Kullanıcı adı en az 3 karakter")
    .max(
      AUTH_TEXT_LIMITS.username,
      `Kullanıcı adı en fazla ${AUTH_TEXT_LIMITS.username} karakter olabilir`,
    )
    .regex(USERNAME_REGEX, "Kullanıcı adı sadece küçük harf, rakam ve _ içerebilir"),
  email: emailSchema,
  password: strongPasswordSchema,
  university: z
    .string()
    .trim()
    .min(2, "Üniversite zorunlu")
    .max(
      AUTH_TEXT_LIMITS.university,
      `Üniversite en fazla ${AUTH_TEXT_LIMITS.university} karakter olabilir`,
    ),
  description: z
    .string()
    .trim()
    .max(
      AUTH_TEXT_LIMITS.clubDescription,
      `Açıklama en fazla ${AUTH_TEXT_LIMITS.clubDescription} karakter olabilir`,
    ),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: strongPasswordSchema,
});

export type LoginForm = z.infer<typeof loginSchema>;
export type StudentRegisterForm = z.infer<typeof studentRegisterSchema>;
export type ClubRegisterForm = z.infer<typeof clubRegisterSchema>;
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
