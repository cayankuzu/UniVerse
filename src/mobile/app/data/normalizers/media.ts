import type { ImageVariants } from "../contracts/api";

export type { ImageVariants } from "../contracts/api";

export type ImageVariantKey = keyof ImageVariants;

function normalizeVariantValue(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

export function normalizeImageVariants(value: unknown): ImageVariants | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const variants = {
    thumbnail: normalizeVariantValue(input.thumbnail),
    medium: normalizeVariantValue(input.medium),
    full: normalizeVariantValue(input.full),
  } satisfies ImageVariants;

  if (!variants.thumbnail && !variants.medium && !variants.full) {
    return undefined;
  }
  return variants;
}

type CollectImageVariantUriOptions = {
  fallbackToFull?: boolean;
  limit?: number;
  preferredOrder?: ImageVariantKey[];
};

export function collectImageVariantUris(
  variants?: ImageVariants | null,
  options?: CollectImageVariantUriOptions,
) {
  const preferredOrder = options?.preferredOrder ?? ["thumbnail", "medium", "full"];
  const fallbackToFull = options?.fallbackToFull ?? true;
  const seen = new Set<string>();
  const uris: string[] = [];

  preferredOrder.forEach((key) => {
    const uri = normalizeVariantValue(variants?.[key]);
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    uris.push(uri);
  });

  if (fallbackToFull && !uris.length) {
    const full = normalizeVariantValue(variants?.full);
    if (full && !seen.has(full)) {
      seen.add(full);
      uris.push(full);
    }
  }

  const limit = Math.max(0, Number(options?.limit ?? uris.length));
  return uris.slice(0, limit);
}

export function pickImageVariantUri(
  variants?: ImageVariants | null,
  options?: Omit<CollectImageVariantUriOptions, "limit">,
) {
  return (
    collectImageVariantUris(variants, {
      ...options,
      limit: 1,
    })[0] || ""
  );
}
