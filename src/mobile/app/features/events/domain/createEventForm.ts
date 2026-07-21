import { eventTypes } from "../../../shared/catalog/taxonomy";

export interface CreateEventFormState {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  type: string;
  access: string;
  fee: string;
  feeAmount: string;
  capacity: string;
  targetAudience: string;
  level: string;
  materials: string;
}

export const TOTAL_CREATE_EVENT_STEPS = 2;
export const CREATE_EVENT_STEP_LABELS = ["Temel Bilgiler", "Tarih & Detaylar"] as const;

export const EVENT_TYPES = eventTypes;

export const ACCESS_OPTIONS = [
  "Herkese Açık",
  "Sadece Kendi Üniversitemiz",
  "Sadece Uyeler",
] as const;

export const LEVEL_OPTIONS = ["Başlangıç", "Orta", "İleri", "Tüm seviyeler"] as const;

export const INITIAL_CREATE_EVENT_FORM: CreateEventFormState = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  location: "",
  address: "",
  type: "Seminer",
  access: "Herkese Açık",
  fee: "Ücretsiz",
  feeAmount: "",
  capacity: "100",
  targetAudience: "",
  level: "Tüm seviyeler",
  materials: "",
};

export function hasCreateEventDraftChanges(params: {
  coverImageUri?: string;
  form: CreateEventFormState;
  selectedCategories?: string[];
}) {
  if (String(params.coverImageUri || "").trim().length > 0) {
    return true;
  }
  if ((params.selectedCategories || []).some((value) => String(value || "").trim().length > 0)) {
    return true;
  }
  return (Object.keys(INITIAL_CREATE_EVENT_FORM) as Array<keyof CreateEventFormState>).some(
    (field) => params.form[field] !== INITIAL_CREATE_EVENT_FORM[field],
  );
}
