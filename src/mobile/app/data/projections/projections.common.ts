import type { ProjectionEnvelope } from "../../data/query/contracts";

export function normalizeProjectionValue(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function hasProjectionPayload<T>(envelope: ProjectionEnvelope<T>) {
  return Boolean(
    (envelope.items && envelope.items.length > 0) ||
    (envelope.updatedItems && envelope.updatedItems.length > 0) ||
    (envelope.deletedIds && envelope.deletedIds.length > 0),
  );
}
