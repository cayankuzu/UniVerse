export function normalizeEventCreateErrorMessage(error: unknown) {
  const rawMessage = String((error as { message?: string } | null)?.message || error || "").trim();
  const normalized = rawMessage.toLowerCase();
  if (!rawMessage) return "Etkinlik oluşturulamadı.";
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("oturum") ||
    normalized.includes("jwt")
  ) {
    return "Oturumunuzu yenileyip tekrar deneyin.";
  }
  if (
    normalized.includes("only club accounts can create events") ||
    normalized.includes("only clubs can create events") ||
    normalized.includes("club profile not found")
  ) {
    return "Etkinlik yalnızca kulüp hesaplarıyla paylaşılabilir.";
  }
  if (normalized.includes("events_desc_len")) {
    return "Etkinlik açıklaması en az 10 karakter olmalı.";
  }
  if (normalized.includes("events_title_len")) {
    return "Etkinlik başlığı 3 ile 120 karakter arasında olmalı.";
  }
  if (normalized.includes("events_capacity_positive") || normalized.includes("kapasite geçersiz")) {
    return "Kontenjan 0'dan büyük olmalı.";
  }
  if (normalized.includes("events_time_range")) {
    return "Bitiş tarihi ve saati başlangıçtan önce olamaz.";
  }
  return rawMessage;
}
