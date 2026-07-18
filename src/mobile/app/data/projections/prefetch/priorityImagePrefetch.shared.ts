import { getMediaUriCacheKey } from "../../../shared/media/mediaUri";
import { isVideoMediaUri } from "../../../shared/media/mediaVideoUtils";
import { appendProjectionFieldUris } from "../projectionImages.shared";

export function collectPriorityImageUris(items: unknown[], maxImages: number) {
  const uris: string[] = [];
  const appendRecordUris = (record: Record<string, unknown> | null) => {
    if (!record) return;
    const rawImageUri = String(record.image || "").trim();
    appendProjectionFieldUris(uris, {
      imageLimit: 1,
      preferredOrder: ["thumbnail"],
      rawFallback: !isVideoMediaUri(rawImageUri),
      rawUri: rawImageUri,
      variants: record.imageVariants || record.image_variants,
    });
    appendProjectionFieldUris(uris, {
      imageLimit: 1,
      preferredOrder: ["thumbnail"],
      rawFallback: true,
      rawUri: record.coverImage || record.cover_image,
      variants: record.coverImageVariants || record.cover_image_variants,
    });
    appendProjectionFieldUris(uris, {
      imageLimit: 1,
      preferredOrder: ["thumbnail"],
      rawFallback: true,
      rawUri: record.profileImage || record.profile_image || record.clubImage || record.userImage,
      variants: record.profileImageVariants || record.profile_image_variants,
    });
  };
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    appendRecordUris(record);
    appendRecordUris(
      record.event && typeof record.event === "object"
        ? (record.event as Record<string, unknown>)
        : null,
    );
    appendRecordUris(
      record.album && typeof record.album === "object"
        ? (record.album as Record<string, unknown>)
        : null,
    );
    appendRecordUris(
      record.profile && typeof record.profile === "object"
        ? (record.profile as Record<string, unknown>)
        : null,
    );
    if (uris.length >= maxImages * 2) break;
  }
  const uniqueUris = new Map<string, string>();
  uris.forEach((uri) => {
    const cacheKey = getMediaUriCacheKey(uri);
    if (cacheKey && !uniqueUris.has(cacheKey)) uniqueUris.set(cacheKey, uri);
  });
  return Array.from(uniqueUris.values()).slice(0, Math.max(0, maxImages));
}
