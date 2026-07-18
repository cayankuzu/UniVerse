import AsyncStorage from "@react-native-async-storage/async-storage";
import { debugWarn } from "../../../platform/logging/logger";
import { supabase } from "../../../platform/supabase";
import {
  clearLocalEventShadowStorage as clearLocalEventShadowStorageBase,
  EVENT_LOCAL_SHADOW_STORAGE_KEY,
  registerEventLocalShadowReset,
} from "../localShadowStorage";
import type { EventWithMeta } from "./events.models";
import { mergeEventCollections } from "./events.models";

const MAX_SHADOW_ITEMS = 120;
let shadowMemoryCache: Record<string, EventWithMeta[]> | null = null;

registerEventLocalShadowReset(() => {
  shadowMemoryCache = null;
});

function normalize(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function sortEvents(items: EventWithMeta[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(String(a.createdAt || a.startDate || a.date || "")).getTime();
    const bTime = new Date(String(b.createdAt || b.startDate || b.date || "")).getTime();
    return bTime - aTime;
  });
}

function normalizeShadowItems(items: EventWithMeta[]) {
  return sortEvents(mergeEventCollections(items).slice(0, MAX_SHADOW_ITEMS));
}

async function resolveShadowViewerKey() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return normalize(String(user?.id || user?.email || "guest"));
  } catch (error) {
    debugWarn("CONTENT/EVENTS", "event-shadow-viewer-resolve-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "event-shadow-viewer-resolve-failed",
      ),
    });
    return "guest";
  }
}

async function readShadowStore(): Promise<Record<string, EventWithMeta[]>> {
  if (shadowMemoryCache) return shadowMemoryCache;
  try {
    const raw = await AsyncStorage.getItem(EVENT_LOCAL_SHADOW_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      shadowMemoryCache = {};
      return shadowMemoryCache;
    }
    shadowMemoryCache = Object.entries(parsed as Record<string, EventWithMeta[]>).reduce<
      Record<string, EventWithMeta[]>
    >((acc, [key, items]) => {
      acc[key] = Array.isArray(items) ? normalizeShadowItems(items) : [];
      return acc;
    }, {});
    return shadowMemoryCache;
  } catch (error) {
    debugWarn("CONTENT/EVENTS", "event-shadow-read-failed", {
      message: String(
        (error as { message?: string } | null)?.message || "event-shadow-read-failed",
      ),
    });
    shadowMemoryCache = {};
    return shadowMemoryCache;
  }
}

async function readShadowItems(): Promise<EventWithMeta[]> {
  const viewerKey = await resolveShadowViewerKey();
  const store = await readShadowStore();
  return normalizeShadowItems(store[viewerKey] || []);
}

async function writeShadowItems(items: EventWithMeta[]) {
  const viewerKey = await resolveShadowViewerKey();
  const store = await readShadowStore();
  const normalized = normalizeShadowItems(items);
  const nextStore = {
    ...store,
    [viewerKey]: normalized,
  };
  shadowMemoryCache = nextStore;
  await AsyncStorage.setItem(EVENT_LOCAL_SHADOW_STORAGE_KEY, JSON.stringify(nextStore));
}

export async function getAllLocalEventShadow() {
  return readShadowItems();
}

export async function persistLocalEventShadow(item: EventWithMeta) {
  if (!item?.id) return;
  const existing = await readShadowItems();
  await writeShadowItems([item, ...existing]);
}

export async function patchLocalEventShadow(eventId: string, patch: Partial<EventWithMeta>) {
  const normalizedId = normalize(eventId);
  if (!normalizedId) return null;
  let nextItem: EventWithMeta | null = null;
  const existing = await readShadowItems();
  const nextItems = existing.map((item) => {
    if (normalize(item.id) !== normalizedId) return item;
    nextItem = { ...item, ...patch };
    return nextItem;
  });
  await writeShadowItems(nextItems);
  return nextItem;
}

export async function removeLocalEventShadow(eventId: string) {
  const normalizedId = normalize(eventId);
  if (!normalizedId) return;
  const existing = await readShadowItems();
  await writeShadowItems(existing.filter((item) => normalize(item.id) !== normalizedId));
}

export async function replaceLocalEventShadow(previousId: string, nextItem: EventWithMeta) {
  const normalizedPreviousId = normalize(previousId);
  if (!normalizedPreviousId || !nextItem?.id) return;
  const existing = await readShadowItems();
  await writeShadowItems([
    nextItem,
    ...existing.filter(
      (item) =>
        normalize(item.id) !== normalizedPreviousId &&
        normalize(item.id) !== normalize(nextItem.id),
    ),
  ]);
}

export async function getLocalEventShadowByClubUsername(username: string) {
  const normalizedUsername = normalize(username);
  if (!normalizedUsername) return [];
  const items = await readShadowItems();
  return items.filter((item) => normalize(item.clubUsername || "") === normalizedUsername);
}

export async function getLocalEventShadowByClubUserId(userId: string) {
  const normalizedUserId = normalize(userId);
  if (!normalizedUserId) return [];
  const items = await readShadowItems();
  return items.filter((item) => normalize(item.clubUserId || "") === normalizedUserId);
}

export async function clearLocalEventShadowStorage() {
  shadowMemoryCache = null;
  await clearLocalEventShadowStorageBase();
}
