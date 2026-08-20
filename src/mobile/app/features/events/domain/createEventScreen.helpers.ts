import type { FieldErrors } from "react-hook-form";
import type { CreateEventFormState } from "./createEventForm";
import { createEventSchema, type CreateEventFormValues } from "./createEvent.schema";

export const CREATE_EVENT_STEP_FIELDS: Record<number, Array<keyof CreateEventFormValues>> = {
  1: ["title", "description", "type"],
  2: [
    "access",
    "address",
    "startDate",
    "startTime",
    "endDate",
    "endTime",
    "location",
    "capacity",
    "fee",
    "feeAmount",
    "level",
    "materials",
    "targetAudience",
  ],
};

const CREATE_EVENT_FIELD_LABELS: Record<keyof CreateEventFormValues, string> = {
  access: "Erişim",
  address: "Adres",
  capacity: "Kontenjan",
  description: "Açıklama",
  endDate: "Bitiş tarihi",
  endTime: "Bitiş saati",
  fee: "Ücret bilgisi",
  feeAmount: "Ücret tutarı",
  level: "Seviye",
  location: "Konum",
  materials: "Gerekli malzemeler",
  startDate: "Başlangıç tarihi",
  startTime: "Başlangıç saati",
  targetAudience: "Hedef kitle",
  title: "Başlık",
  type: "Etkinlik tipi",
};

export function mapCreateEventFieldErrors(
  errors: FieldErrors<CreateEventFormValues>,
): Partial<Record<keyof CreateEventFormValues, string | undefined>> {
  return {
    access: errors.access?.message,
    address: errors.address?.message,
    capacity: errors.capacity?.message,
    description: errors.description?.message,
    endDate: errors.endDate?.message,
    endTime: errors.endTime?.message,
    fee: errors.fee?.message,
    feeAmount: errors.feeAmount?.message,
    level: errors.level?.message,
    location: errors.location?.message,
    materials: errors.materials?.message,
    startDate: errors.startDate?.message,
    startTime: errors.startTime?.message,
    targetAudience: errors.targetAudience?.message,
    title: errors.title?.message,
    type: errors.type?.message,
  };
}

export function resolveCreateEventStepError(
  step: number,
  errors: Partial<Record<keyof CreateEventFormValues, string | undefined>>,
) {
  return CREATE_EVENT_STEP_FIELDS[step].map((field) => errors[field]).find(Boolean) || null;
}

export function getFirstCreateEventInvalidField(params: {
  errors: Partial<Record<keyof CreateEventFormValues, string | undefined>>;
  fields?: readonly (keyof CreateEventFormValues)[];
}) {
  const fields =
    params.fields ?? (Object.keys(CREATE_EVENT_FIELD_LABELS) as Array<keyof CreateEventFormValues>);
  return fields.find((field) => Boolean(params.errors[field])) ?? null;
}

export function getCreateEventValidationErrors(
  values: CreateEventFormValues,
): Partial<Record<keyof CreateEventFormValues, string | undefined>> {
  const parsed = createEventSchema.safeParse(values);
  if (parsed.success) return {};

  const nextErrors: Partial<Record<keyof CreateEventFormValues, string | undefined>> = {};
  for (const issue of parsed.error.issues) {
    const field =
      typeof issue.path[0] === "string" ? (issue.path[0] as keyof CreateEventFormValues) : null;
    if (!field || nextErrors[field]) continue;
    const message = String(issue.message || "").trim();
    const label = CREATE_EVENT_FIELD_LABELS[field];
    nextErrors[field] = message ? `${label}: ${message}` : label;
  }
  return nextErrors;
}

export function formatCreateEventValidationSummary(params: {
  errors: Partial<Record<keyof CreateEventFormValues, string | undefined>>;
  limit?: number;
  step?: number;
}) {
  const fields = params.step
    ? CREATE_EVENT_STEP_FIELDS[params.step] || []
    : (Object.keys(CREATE_EVENT_FIELD_LABELS) as Array<keyof CreateEventFormValues>);
  const messages = Array.from(
    new Set(
      fields
        .map((field) => params.errors[field])
        .filter((value): value is string => Boolean(String(value || "").trim())),
    ),
  );
  const limit = typeof params.limit === "number" ? params.limit : messages.length;
  return messages.slice(0, limit).join("\n") || null;
}

export function canContinueCreateEventStep(step: number, form: CreateEventFormState) {
  if (step === 1) {
    return Boolean(form.title.trim() && form.description.trim());
  }
  if (step === 2) {
    return Boolean(form.startDate.trim() && form.location.trim());
  }
  return true;
}
