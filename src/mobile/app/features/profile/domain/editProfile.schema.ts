import { z } from "zod";
import { TEXT_LIMITS } from "../../../shared/validation/textLimits";

const AUTH_TEXT_LIMITS = TEXT_LIMITS.auth;

export const editProfileSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(AUTH_TEXT_LIMITS.bio, `Biyografi en fazla ${AUTH_TEXT_LIMITS.bio} karakter olabilir.`)
    .optional(),
  clubName: z
    .string()
    .trim()
    .max(
      AUTH_TEXT_LIMITS.clubName,
      `Kulüp adı en fazla ${AUTH_TEXT_LIMITS.clubName} karakter olabilir.`,
    )
    .optional(),
  department: z
    .string()
    .trim()
    .max(
      AUTH_TEXT_LIMITS.department,
      `Bölüm en fazla ${AUTH_TEXT_LIMITS.department} karakter olabilir.`,
    )
    .optional(),
  description: z
    .string()
    .trim()
    .max(
      AUTH_TEXT_LIMITS.clubDescription,
      `Açıklama en fazla ${AUTH_TEXT_LIMITS.clubDescription} karakter olabilir.`,
    )
    .optional(),
  email: z
    .string()
    .trim()
    .max(AUTH_TEXT_LIMITS.email, `E-posta en fazla ${AUTH_TEXT_LIMITS.email} karakter olabilir.`)
    .email("Geçerli e-posta gir"),
  gradeYear: z
    .string()
    .trim()
    .max(
      AUTH_TEXT_LIMITS.gradeYear,
      `Sınıf bilgisi en fazla ${AUTH_TEXT_LIMITS.gradeYear} karakter olabilir.`,
    )
    .optional(),
  name: z
    .string()
    .trim()
    .max(AUTH_TEXT_LIMITS.name, `Ad en fazla ${AUTH_TEXT_LIMITS.name} karakter olabilir.`)
    .optional(),
  university: z
    .string()
    .trim()
    .min(1, "Üniversite zorunlu.")
    .max(
      AUTH_TEXT_LIMITS.university,
      `Üniversite en fazla ${AUTH_TEXT_LIMITS.university} karakter olabilir.`,
    ),
  username: z
    .string()
    .min(3, "Kullanıcı adı en az 3 karakter olmalı.")
    .max(
      AUTH_TEXT_LIMITS.username,
      `Kullanıcı adı en fazla ${AUTH_TEXT_LIMITS.username} karakter olabilir.`,
    )
    .regex(/^[a-z0-9_]+$/, "Kullanıcı adı sadece küçük harf, rakam ve _ içerebilir"),
});

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
