import { z } from "zod";

export const createEventSchema = z
  .object({
    access: z.string().min(1, "Erişim seçimi zorunlu."),
    address: z.string().optional(),
    capacity: z.string().min(1, "Kontenjan zorunlu."),
    description: z
      .string()
      .trim()
      .min(10, "Etkinlik açıklaması en az 10 karakter olmalı.")
      .max(4000, "Etkinlik açıklaması en fazla 4000 karakter olabilir."),
    endDate: z.string().optional(),
    endTime: z.string().optional(),
    fee: z.string().min(1, "Ücret bilgisi zorunlu."),
    feeAmount: z.string().optional(),
    level: z.string().min(1, "Seviye seçimi zorunlu."),
    location: z.string().min(1, "Konum zorunlu."),
    materials: z.string().optional(),
    startDate: z.string().min(1, "Başlangıç tarihi zorunlu."),
    startTime: z.string().optional(),
    targetAudience: z.string().optional(),
    title: z
      .string()
      .trim()
      .min(3, "Etkinlik başlığı en az 3 karakter olmalı.")
      .max(120, "Etkinlik başlığı en fazla 120 karakter olabilir."),
    type: z.string().min(1, "Etkinlik tipi zorunlu."),
  })
  .superRefine((value, context) => {
    const capacity = parseInt(String(value.capacity || "").trim(), 10);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kontenjan 0'dan büyük olmalı.",
        path: ["capacity"],
      });
    }

    const startAt = parseDateTime(value.startDate, value.startTime, "10:00");
    const endDate = String(value.endDate || value.startDate || "").trim();
    const endAt = parseDateTime(endDate, value.endTime || value.startTime, "12:00");
    if (!startAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Başlangıç tarihi veya saati geçersiz.",
        path: ["startDate"],
      });
    }
    if (!endAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitiş tarihi veya saati geçersiz.",
        path: ["endDate"],
      });
    }
    if (startAt && endAt) {
      if (startAt.getTime() < Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Geçmiş tarih veya saatte etkinlik oluşturulamaz.",
          path: ["startDate"],
        });
      }
      if (endAt.getTime() < startAt.getTime()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bitiş tarihi ve saati başlangıçtan önce olamaz.",
          path: ["endDate"],
        });
      }
    }

    if (String(value.fee || "") === "Ücretli") {
      const amount = parseInt(String(value.feeAmount || "").trim(), 10);
      if (!Number.isFinite(amount) || amount <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ücretli etkinlik için geçerli bir tutar girin.",
          path: ["feeAmount"],
        });
      }
    }
  });

function parseDateTime(dateValue: string, timeValue: string | undefined, fallbackTime: string) {
  const date = String(dateValue || "").trim();
  const time = String(timeValue || fallbackTime).trim() || fallbackTime;
  if (!date) return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type CreateEventFormValues = z.infer<typeof createEventSchema>;
