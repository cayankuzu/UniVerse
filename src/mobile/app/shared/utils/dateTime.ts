export function toDatePart(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function toTimePart(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(11, 16);
}

export function toIsoDateTime(date: string, time: string): string {
  const trimmedDate = date.trim();
  const trimmedTime = (time || "00:00").trim();
  if (!trimmedDate) {
    return new Date().toISOString();
  }

  const candidate = new Date(`${trimmedDate}T${trimmedTime}:00`);
  if (Number.isNaN(candidate.getTime())) {
    return new Date().toISOString();
  }
  return candidate.toISOString();
}

function formatDateSegment(value: number) {
  return String(value).padStart(2, "0");
}

export function formatAbsoluteDateTime(iso: string | null | undefined): string {
  const normalized = String(iso || "").trim();
  if (!normalized) return "";

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";

  const day = formatDateSegment(date.getDate());
  const month = formatDateSegment(date.getMonth() + 1);
  const year = String(date.getFullYear());
  const hours = formatDateSegment(date.getHours());
  const minutes = formatDateSegment(date.getMinutes());
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export function timeAgo(iso: string): string {
  return formatAbsoluteDateTime(iso) || "Tarih bilinmiyor";
}
