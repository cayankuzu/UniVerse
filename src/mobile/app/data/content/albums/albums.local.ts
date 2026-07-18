import AsyncStorage from "@react-native-async-storage/async-storage";
import { debugWarn } from "../../../platform/logging/logger";
import { supabase } from "../../../platform/supabase";
import {
  ALBUM_LOCAL_SHADOW_STORAGE_KEY,
  clearLocalAlbumShadowStorage as clearLocalAlbumShadowStorageBase,
  registerAlbumLocalShadowReset,
} from "../localShadowStorage";
import {
  mergeAlbumCollections,
  normalizeAlbumLookupValue,
  type AlbumPhotoWithMeta,
} from "./albums.shared";

const MAX_SHADOW_ITEMS = 160;
let shadowMemoryCache: Record<string, AlbumPhotoWithMeta[]> | null = null;
const shadowMutationListeners = new Set<() => void>();

registerAlbumLocalShadowReset(() => {
  shadowMemoryCache = null;
});

function sortAlbums(items: AlbumPhotoWithMeta[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(String(a.createdAt || "")).getTime();
    const bTime = new Date(String(b.createdAt || "")).getTime();
    return bTime - aTime;
  });
}

function normalizeShadowItems(items: AlbumPhotoWithMeta[]) {
  return sortAlbums(mergeAlbumCollections(items).slice(0, MAX_SHADOW_ITEMS));
}

async function resolveShadowViewerKey() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return normalizeAlbumLookupValue(String(user?.id || user?.email || "guest"));
  } catch (error) {
    debugWarn("CONTENT/ALBUMS", "album-shadow-viewer-resolve-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "album-shadow-viewer-resolve-failed",
      ),
    });
    return "guest";
  }
}

async function readShadowStore(): Promise<Record<string, AlbumPhotoWithMeta[]>> {
  if (shadowMemoryCache) return shadowMemoryCache;
  try {
    const raw = await AsyncStorage.getItem(ALBUM_LOCAL_SHADOW_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      shadowMemoryCache = {};
      return shadowMemoryCache;
    }
    shadowMemoryCache = Object.entries(parsed as Record<string, AlbumPhotoWithMeta[]>).reduce<
      Record<string, AlbumPhotoWithMeta[]>
    >((acc, [key, items]) => {
      acc[key] = Array.isArray(items) ? normalizeShadowItems(items) : [];
      return acc;
    }, {});
    return shadowMemoryCache;
  } catch (error) {
    debugWarn("CONTENT/ALBUMS", "album-shadow-read-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "album-shadow-read-failed",
      ),
    });
    shadowMemoryCache = {};
    return shadowMemoryCache;
  }
}

async function readShadowItems(): Promise<AlbumPhotoWithMeta[]> {
  const viewerKey = await resolveShadowViewerKey();
  const store = await readShadowStore();
  return normalizeShadowItems(store[viewerKey] || []);
}

async function writeShadowItems(items: AlbumPhotoWithMeta[]) {
  const viewerKey = await resolveShadowViewerKey();
  const store = await readShadowStore();
  const normalized = normalizeShadowItems(items);
  const nextStore = {
    ...store,
    [viewerKey]: normalized,
  };
  shadowMemoryCache = nextStore;
  await AsyncStorage.setItem(ALBUM_LOCAL_SHADOW_STORAGE_KEY, JSON.stringify(nextStore));
  shadowMutationListeners.forEach((listener) => {
    listener();
  });
}

export function registerAlbumLocalShadowMutation(listener: () => void) {
  shadowMutationListeners.add(listener);
  return () => {
    shadowMutationListeners.delete(listener);
  };
}

export async function persistLocalAlbumShadow(item: AlbumPhotoWithMeta) {
  if (!item?.id) return;
  const existing = await readShadowItems();
  await writeShadowItems([item, ...existing]);
}

export async function removeLocalAlbumShadow(itemId: string) {
  const normalizedId = String(itemId || "").trim();
  if (!normalizedId) return;
  const existing = await readShadowItems();
  const nextItems = existing.filter((item) => String(item.id || "").trim() !== normalizedId);
  if (nextItems.length === existing.length) {
    return;
  }
  await writeShadowItems(nextItems);
}

export async function getLocalAlbumShadowFeed() {
  return readShadowItems();
}

export async function getLocalAlbumShadowByEventIds(eventIds: string[]) {
  const targetIds = new Set(eventIds.map((item) => String(item || "").trim()).filter(Boolean));
  if (!targetIds.size) return [];
  const items = await readShadowItems();
  return items.filter((item) => targetIds.has(String(item.eventId || "").trim()));
}

export async function getLocalAlbumShadowForProfile(username: string) {
  const normalizedUsername = normalizeAlbumLookupValue(username);
  if (!normalizedUsername) return [];
  const items = await readShadowItems();
  return items.filter((item) => {
    const uploaderUsername = normalizeAlbumLookupValue(item.username || "");
    const clubUsername = normalizeAlbumLookupValue(item.clubUsername || "");
    return uploaderUsername === normalizedUsername || clubUsername === normalizedUsername;
  });
}

export async function clearLocalAlbumShadowStorage() {
  shadowMemoryCache = null;
  await clearLocalAlbumShadowStorageBase();
}
