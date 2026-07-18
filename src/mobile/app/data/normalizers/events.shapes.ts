function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNumericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasEventScheduleShape(item: Record<string, unknown>) {
  return [
    item.starts_at,
    item.date,
    item.startDate,
    item.start_date,
    item.endDate,
    item.end_date,
    item.startTime,
    item.start_time,
    item.endTime,
    item.end_time,
  ].some(hasNonEmptyString);
}

function hasEventMetadataShape(item: Record<string, unknown>) {
  return (
    hasNonEmptyString(item.location) ||
    hasNonEmptyString(item.location_name) ||
    hasNonEmptyString(item.type) ||
    hasNonEmptyString(item.event_type) ||
    hasNonEmptyString(item.access) ||
    hasNonEmptyString(item.access_label) ||
    hasNonEmptyString(item.fee) ||
    hasNonEmptyString(item.fee_label) ||
    hasNumericValue(item.capacity)
  );
}

function hasAlbumProjectionMarkers(item: Record<string, unknown>) {
  return (
    hasNonEmptyString(item.photo_id) ||
    hasNonEmptyString(item.eventId) ||
    hasNonEmptyString(item.event_id) ||
    Array.isArray(item.images) ||
    Array.isArray(item.media_paths) ||
    hasNumericValue(item.photoCount) ||
    hasNumericValue(item.photo_count) ||
    hasNonEmptyString(item.caption)
  );
}

export function hasEventRpcShape(item: Record<string, unknown>) {
  return (
    hasNonEmptyString(item.club_user_id) ||
    hasNonEmptyString(item.club_username) ||
    hasNonEmptyString(item.starts_at)
  );
}

export function isEventProjectionLike(item: Record<string, unknown>) {
  const id = String(item.id || "").trim();
  if (!id) return false;
  if (hasEventScheduleShape(item)) return true;
  if (hasAlbumProjectionMarkers(item)) return false;
  return hasEventMetadataShape(item);
}
