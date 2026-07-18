import type { FieldErrors } from "react-hook-form";

import { editProfileSchema, type EditProfileFormValues } from "../domain/editProfile.schema";

export type EditProfileStep = 1 | 2 | 3 | 4 | 5;
export type EditProfileFieldName = keyof EditProfileFormValues;

export const EDIT_PROFILE_FIELDS = [
  "bio",
  "clubName",
  "department",
  "description",
  "email",
  "gradeYear",
  "name",
  "university",
  "username",
] as const;

export const EDIT_PROFILE_STEP_FIELDS: Record<EditProfileStep, readonly EditProfileFieldName[]> = {
  1: ["username", "clubName", "name"],
  2: ["email", "university", "department", "gradeYear"],
  3: ["description", "bio"],
  4: [],
  5: [],
};

export function getEditProfileStepForField(fieldName: EditProfileFieldName): EditProfileStep {
  for (const [step, fields] of Object.entries(EDIT_PROFILE_STEP_FIELDS)) {
    if (fields.includes(fieldName)) return Number(step) as EditProfileStep;
  }
  return 1;
}

export function mapEditProfileFieldErrors(
  errors: FieldErrors<EditProfileFormValues>,
): Partial<Record<EditProfileFieldName, string | undefined>> {
  return {
    bio: errors.bio?.message,
    clubName: errors.clubName?.message,
    department: errors.department?.message,
    description: errors.description?.message,
    email: errors.email?.message,
    gradeYear: errors.gradeYear?.message,
    name: errors.name?.message,
    university: errors.university?.message,
    username: errors.username?.message,
  };
}

export function getFirstEditProfileInvalidField(params: {
  errors: Partial<Record<EditProfileFieldName, string | undefined>>;
  isClub: boolean;
  step?: EditProfileStep;
}) {
  const fieldOrder: EditProfileFieldName[] = params.isClub
    ? ["username", "clubName", "email", "university", "description"]
    : ["username", "name", "email", "university", "department", "gradeYear", "bio"];
  const fields = params.step
    ? fieldOrder.filter((field) =>
        EDIT_PROFILE_STEP_FIELDS[params.step as EditProfileStep].includes(field),
      )
    : fieldOrder;
  return fields.find((field) => Boolean(params.errors[field])) ?? null;
}

export function getEditProfileValidationErrors(
  values: EditProfileFormValues,
): Partial<Record<EditProfileFieldName, string | undefined>> {
  const parsed = editProfileSchema.safeParse(values);
  if (parsed.success) return {};

  const nextErrors: Partial<Record<EditProfileFieldName, string | undefined>> = {};
  for (const issue of parsed.error.issues) {
    const field =
      typeof issue.path[0] === "string" ? (issue.path[0] as EditProfileFieldName) : null;
    if (!field || nextErrors[field]) continue;
    nextErrors[field] = String(issue.message || "").trim();
  }
  return nextErrors;
}

export function getEditProfileStepDescription(step: EditProfileStep) {
  switch (step) {
    case 1:
      return "Temel profil bilgilerini güncelle";
    case 2:
      return "Üniversite ve iletişim bilgilerini kontrol et";
    case 3:
      return "Profil görselleri ve açıklama";
    case 4:
      return "Kategori seçimini tamamla";
    default:
      return "Kaydetmeden once onizlemeyi kontrol et";
  }
}

export function getEditProfileStepValidationError(params: {
  errors: FieldErrors<EditProfileFormValues>;
  isClub: boolean;
  step: EditProfileStep;
}) {
  if (params.step === 1) {
    return String(
      params.errors.username?.message ||
        (params.isClub ? params.errors.clubName?.message : params.errors.name?.message) ||
        "Temel bilgileri kontrol et.",
    );
  }

  return String(
    params.errors.email?.message ||
      params.errors.university?.message ||
      params.errors.department?.message ||
      params.errors.gradeYear?.message ||
      "Üniversite ve iletişim bilgilerini kontrol et.",
  );
}
