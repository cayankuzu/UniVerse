import type { ProjectionEnvelope } from "../../../data/query/contracts";
import { AlbumAPI, EventAPI, getLocalEventShadowByClubUsername } from "../../../data/content";
import { mapEnvelopeItems } from "../../../data/projections/projections.api.helpers";
import {
  hasAlbumProjectionSurfaceFlags,
  normalizeAlbumProjectionItem,
} from "../../../data/normalizers/albums";
import { normalizeProjectionEvent } from "../../../data/normalizers/events";
import { hydrateAlbumProjectionEnvelope } from "../../../data/projections/projectionAlbumSurfaceHydration";

function mergeItemsById<T extends { id?: string }>(leadingItems: T[], trailingItems: T[]) {
  const merged = new Map<string, T>();

  [...leadingItems, ...trailingItems].forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id) return;
    merged.set(id, item);
  });

  return Array.from(merged.values());
}

function normalizeProfileEventProjectionItem(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const normalizedEvent = normalizeProjectionEvent(item.event || row);
  if (!normalizedEvent) return null;
  const topLevelAlbumCount =
    typeof item.albumCount === "number"
      ? item.albumCount
      : typeof item.album_count === "number"
        ? Number(item.album_count)
        : null;
  if (typeof topLevelAlbumCount !== "number") {
    return normalizedEvent;
  }
  return {
    ...normalizedEvent,
    albumCount: Math.max(Number(normalizedEvent.albumCount || 0), topLevelAlbumCount),
  };
}

export async function mergeProfileEventEnvelopeWithLocalShadow<T extends { id?: string }>(
  username: string,
  envelope: ProjectionEnvelope<T>,
  options?: {
    allowLocalShadow?: boolean;
  },
) {
  if (!options?.allowLocalShadow) {
    return envelope;
  }

  const localShadowItems = await getLocalEventShadowByClubUsername(username);
  if (localShadowItems.length === 0) {
    return envelope;
  }

  return {
    ...envelope,
    items: mergeItemsById(localShadowItems as unknown as T[], envelope.items || []),
  };
}

export async function mapProfileEventEnvelope(params: {
  allowLocalShadow?: boolean;
  envelope: ProjectionEnvelope<unknown>;
  recoverEmpty?: boolean;
  username: string;
}) {
  const mappedEnvelope = mapEnvelopeItems(params.envelope, normalizeProfileEventProjectionItem);
  const hasMappedEvents =
    (mappedEnvelope.items?.length || 0) > 0 || (mappedEnvelope.updatedItems?.length || 0) > 0;
  if (hasMappedEvents || !params.recoverEmpty) {
    return mergeProfileEventEnvelopeWithLocalShadow(params.username, mappedEnvelope, {
      allowLocalShadow: params.allowLocalShadow,
    });
  }

  const recoveredItems = await EventAPI.getProfileEvents(params.username);
  return mergeProfileEventEnvelopeWithLocalShadow(
    params.username,
    {
      ...mappedEnvelope,
      deletedIds: [],
      items: recoveredItems,
      nextCursor: null,
      updatedItems: [],
    },
    { allowLocalShadow: params.allowLocalShadow },
  );
}

export async function mapProfileAlbumEnvelope(params: {
  envelope: ProjectionEnvelope<unknown>;
  recoverEmpty?: boolean;
  username: string;
}) {
  const idsNeedingHydration = new Set<string>();
  const mappedEnvelope = await hydrateAlbumProjectionEnvelope(
    mapEnvelopeItems(params.envelope, (row) => {
      const item = normalizeAlbumProjectionItem(row);
      if (item && !hasAlbumProjectionSurfaceFlags(row)) {
        idsNeedingHydration.add(item.id);
      }
      return item;
    }),
    idsNeedingHydration,
  );
  const hasMappedAlbums =
    (mappedEnvelope.items?.length || 0) > 0 || (mappedEnvelope.updatedItems?.length || 0) > 0;
  if (hasMappedAlbums || !params.recoverEmpty) {
    return mappedEnvelope;
  }

  const recoveredItems = await AlbumAPI.getPhotos(params.username);
  return recoveredItems.length > 0
    ? {
        ...mappedEnvelope,
        deletedIds: [],
        items: recoveredItems,
        nextCursor: null,
        updatedItems: [],
      }
    : mappedEnvelope;
}
