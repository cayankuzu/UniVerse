import type { CreateEventFormState } from "../domain";

export type PickerField = "startDate" | "endDate" | "startTime" | "endTime";

export function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTime(date: Date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function parseDateString(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parseTimeString(value: string) {
  if (!value) return null;
  const [h, m] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date;
}

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function displayDate(value: string) {
  const parsed = parseDateString(value);
  if (!parsed) return "";
  return parsed.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function displayTime(value: string) {
  return value || "";
}

export function resolvePickerState(activePicker: PickerField | null, form: CreateEventFormState) {
  const pickerMode: "date" | "time" = activePicker?.includes("Date") ? "date" : "time";
  const pickerValue = !activePicker
    ? new Date()
    : activePicker === "startDate"
      ? parseDateString(form.startDate) || new Date()
      : activePicker === "endDate"
        ? parseDateString(form.endDate || form.startDate) || new Date()
        : activePicker === "startTime"
          ? parseTimeString(form.startTime) || new Date()
          : parseTimeString(form.endTime || form.startTime) || new Date();
  const minimumDate =
    !activePicker || activePicker === "startTime" || activePicker === "endTime"
      ? undefined
      : activePicker === "startDate"
        ? startOfToday()
        : parseDateString(form.startDate) || startOfToday();

  return {
    minimumDate,
    pickerMode,
    pickerValue,
  };
}

export function applyPickerField(params: {
  field: PickerField;
  form: CreateEventFormState;
  onSetField: (key: keyof CreateEventFormState, value: string) => void;
  selectedDate: Date;
}) {
  const { field, form, onSetField, selectedDate } = params;

  if (field === "startDate") {
    const nextDate = formatDate(selectedDate);
    onSetField("startDate", nextDate);
    const currentEndDate = parseDateString(form.endDate);
    const nextStartDate = parseDateString(nextDate);
    if (
      !form.endDate ||
      (currentEndDate && nextStartDate && currentEndDate.getTime() < nextStartDate.getTime())
    ) {
      onSetField("endDate", nextDate);
    }
    return;
  }

  if (field === "endDate") {
    onSetField("endDate", formatDate(selectedDate));
    return;
  }

  if (field === "startTime") {
    const nextTime = formatTime(selectedDate);
    onSetField("startTime", nextTime);
    const sameDay = !form.endDate || form.endDate === form.startDate;
    const currentEndTime = parseTimeString(form.endTime);
    const nextStartTime = parseTimeString(nextTime);
    if (
      !form.endTime ||
      (sameDay &&
        currentEndTime &&
        nextStartTime &&
        currentEndTime.getTime() < nextStartTime.getTime())
    ) {
      onSetField("endTime", nextTime);
    }
    return;
  }

  onSetField("endTime", formatTime(selectedDate));
}
