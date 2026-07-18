import {
  collectImageVariantUris,
  type ImageVariantKey,
  type ImageVariants,
} from "../normalizers/media";

type UriTarget = Set<string> | string[];

type ProjectionImageFieldOptions = {
  preferredOrder: ImageVariantKey[];
  rawUri?: unknown;
  variants?: unknown;
};

type ProjectionRecordImageOptions = {
  fallbackToFull?: boolean;
  imageLimit?: number;
  includeCover?: boolean;
  includeNested?: boolean;
  includeProfile?: boolean;
  rawFallback?: boolean;
};

function pushUri(target: UriTarget, uri: string) {
  if (Array.isArray(target)) {
    target.push(uri);
    return;
  }
  target.add(uri);
}

export function appendProjectionFieldUris(
  target: UriTarget,
  params: ProjectionImageFieldOptions & ProjectionRecordImageOptions,
) {
  const variantUris = collectImageVariantUris(params.variants as ImageVariants | null | undefined, {
    fallbackToFull: params.fallbackToFull ?? false,
    limit: params.imageLimit ?? 1,
    preferredOrder: params.preferredOrder,
  });
  if (variantUris.length > 0) {
    variantUris.forEach((uri) => {
      pushUri(target, uri);
    });
    return;
  }

  if (!params.rawFallback) return;
  const rawUri = String(params.rawUri || "").trim();
  if (rawUri) {
    pushUri(target, rawUri);
  }
}

export function appendProjectionRecordImageUris(
  target: UriTarget,
  record: Record<string, unknown>,
  options: ProjectionRecordImageOptions = {},
) {
  appendProjectionFieldUris(target, {
    fallbackToFull: options.fallbackToFull,
    imageLimit: options.imageLimit,
    preferredOrder: ["medium", "thumbnail", "full"],
    rawFallback: options.rawFallback,
    rawUri: record.image,
    variants: record.imageVariants || record.image_variants,
  });

  if (options.includeCover !== false) {
    appendProjectionFieldUris(target, {
      fallbackToFull: options.fallbackToFull,
      imageLimit: options.imageLimit,
      preferredOrder: ["medium", "thumbnail", "full"],
      rawFallback: options.rawFallback,
      rawUri: record.coverImage || record.cover_image,
      variants: record.coverImageVariants || record.cover_image_variants,
    });
  }

  if (options.includeProfile) {
    appendProjectionFieldUris(target, {
      fallbackToFull: options.fallbackToFull,
      imageLimit: options.imageLimit,
      preferredOrder: ["thumbnail", "medium", "full"],
      rawFallback: options.rawFallback,
      rawUri: record.profileImage || record.profile_image,
      variants: record.profileImageVariants || record.profile_image_variants,
    });
  }

  if (!options.includeNested) return;

  const nestedEvent = record.event;
  if (nestedEvent && typeof nestedEvent === "object") {
    appendProjectionRecordImageUris(target, nestedEvent as Record<string, unknown>, options);
  }
  const nestedAlbum = record.album;
  if (nestedAlbum && typeof nestedAlbum === "object") {
    appendProjectionRecordImageUris(target, nestedAlbum as Record<string, unknown>, options);
  }
}
