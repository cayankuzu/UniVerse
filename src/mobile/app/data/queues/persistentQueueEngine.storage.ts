import type {
  PersistentQueueEntryBase,
  PersistentQueueEntryPatch,
} from "./persistentQueueEngine.contracts";
import { secureTextStorage } from "../../platform/storage/securePersist";
import {
  getNowIsoString,
  normalizeAttemptCount,
  normalizeDateString,
  normalizeMaxAttempts,
  normalizeOwnerId,
} from "./persistentQueueEngine.shared";

interface PersistentQueueStorageOptions<_Kind extends string, Status extends string> {
  defaultMaxAttempts: number;
  logReadError?: (error: unknown) => void;
  pendingStatus: Status;
  processingStatus: Status;
  schemaVersion: number;
  staleProcessingMs: number;
  storageKey: string;
}

interface QueueEntryInput<Kind extends string> {
  id: string;
  kind: Kind;
  maxAttempts?: number;
  ownerId?: string;
  payload: Record<string, unknown>;
}

function normalizeEntry<
  Kind extends string,
  Status extends string,
  Entry extends PersistentQueueEntryBase<Kind, Status>,
>(
  entry: Entry,
  options: Pick<
    PersistentQueueStorageOptions<Kind, Status>,
    | "defaultMaxAttempts"
    | "pendingStatus"
    | "processingStatus"
    | "schemaVersion"
    | "staleProcessingMs"
  >,
) {
  const createdAt = normalizeDateString(entry.createdAt, getNowIsoString());
  const updatedAt = normalizeDateString(entry.updatedAt, createdAt);
  const updatedAtMs = new Date(updatedAt).getTime();
  const normalizedEntry = {
    ...entry,
    attemptCount: normalizeAttemptCount(entry.attemptCount),
    createdAt,
    maxAttempts: normalizeMaxAttempts(entry.maxAttempts, options.defaultMaxAttempts),
    nextProcessAt: entry.nextProcessAt ? normalizeDateString(entry.nextProcessAt, createdAt) : null,
    ownerId: normalizeOwnerId(entry.ownerId),
    schemaVersion: options.schemaVersion,
    updatedAt,
  } as Entry;

  if (
    normalizedEntry.status === options.processingStatus &&
    Number.isFinite(updatedAtMs) &&
    Date.now() - updatedAtMs > options.staleProcessingMs
  ) {
    const nextUpdatedAt = getNowIsoString();
    return {
      entry: {
        ...normalizedEntry,
        errorMessage: undefined,
        nextProcessAt: nextUpdatedAt,
        status: options.pendingStatus,
        terminalAt: null,
        updatedAt: nextUpdatedAt,
      } as Entry,
      mutated: true,
    };
  }

  const serializedOriginal = JSON.stringify(entry);
  const serializedNormalized = JSON.stringify(normalizedEntry);
  return {
    entry: normalizedEntry,
    mutated: serializedOriginal !== serializedNormalized,
  };
}

export function createPersistentQueueStorageApi<
  Kind extends string,
  Status extends string,
  Entry extends PersistentQueueEntryBase<Kind, Status>,
>(options: PersistentQueueStorageOptions<Kind, Status>) {
  let storageLane: Promise<void> = Promise.resolve();
  const indexStorageKey = `${options.storageKey}:index`;

  function buildEntryStorageKey(entryId: string) {
    return `${options.storageKey}:entry:${String(entryId || "").trim()}`;
  }

  function runSerialized<T>(task: () => Promise<T>) {
    const nextTask = storageLane.then(task, task);
    storageLane = nextTask.then(
      () => undefined,
      () => undefined,
    );
    return nextTask;
  }

  async function readIndexUnlocked() {
    const raw = await secureTextStorage.getItem(indexStorageKey);
    if (!raw) return [] as string[];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [] as string[];
      return Array.from(new Set(parsed.map((item) => String(item || "").trim()).filter(Boolean)));
    } catch {
      return [] as string[];
    }
  }

  async function writeIndexUnlocked(entryIds: string[]) {
    const normalizedIds = Array.from(
      new Set(entryIds.map((item) => String(item || "").trim()).filter(Boolean)),
    );
    if (normalizedIds.length === 0) {
      await secureTextStorage.removeItem(indexStorageKey);
      return;
    }
    await secureTextStorage.setItem(indexStorageKey, JSON.stringify(normalizedIds));
  }

  async function readEntryUnlocked(entryId: string) {
    const normalizedId = String(entryId || "").trim();
    if (!normalizedId) return null;
    const raw = await secureTextStorage.getItem(buildEntryStorageKey(normalizedId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Entry;
    } catch {
      await secureTextStorage.removeItem(buildEntryStorageKey(normalizedId));
      return null;
    }
  }

  async function writeEntryUnlocked(entry: Entry) {
    await secureTextStorage.setItem(buildEntryStorageKey(entry.id), JSON.stringify(entry));
  }

  async function removeEntryUnlocked(entryId: string) {
    await secureTextStorage.removeItem(buildEntryStorageKey(entryId));
  }

  async function readAllEntriesUnlocked() {
    const entryIds = await readIndexUnlocked();
    if (entryIds.length === 0) return [] as Entry[];

    const normalizedEntries: Entry[] = [];
    const retainedIds: string[] = [];
    let indexChanged = false;

    for (const entryId of entryIds) {
      const rawEntry = await readEntryUnlocked(entryId);
      if (!rawEntry) {
        indexChanged = true;
        continue;
      }

      const normalized = normalizeEntry(rawEntry, options);
      if (normalized.mutated) {
        await writeEntryUnlocked(normalized.entry);
      }
      normalizedEntries.push(normalized.entry);
      retainedIds.push(normalized.entry.id);
      if (normalized.entry.id !== entryId) {
        indexChanged = true;
      }
    }

    if (
      indexChanged ||
      retainedIds.length !== entryIds.length ||
      retainedIds.some((entryId, index) => entryId !== entryIds[index])
    ) {
      await writeIndexUnlocked(retainedIds);
    }

    return normalizedEntries;
  }

  async function writeAllEntriesUnlocked(entries: Entry[]) {
    const existingIds = await readIndexUnlocked();
    const nextEntries = entries.map((entry) => normalizeEntry(entry, options).entry);
    const nextIds = nextEntries.map((entry) => entry.id);
    const nextIdSet = new Set(nextIds);

    for (const entry of nextEntries) {
      await writeEntryUnlocked(entry);
    }

    for (const existingId of existingIds) {
      if (!nextIdSet.has(existingId)) {
        await removeEntryUnlocked(existingId);
      }
    }

    await writeIndexUnlocked(nextIds);
  }

  async function readAllEntries() {
    try {
      return await runSerialized(() => readAllEntriesUnlocked());
    } catch (error) {
      options.logReadError?.(error);
      return [] as Entry[];
    }
  }

  async function writeAllEntries(entries: Entry[]) {
    await runSerialized(() => writeAllEntriesUnlocked(entries));
  }

  async function getQueue(kind?: Kind, ownerId?: string) {
    const entries = await readAllEntries();
    return entries.filter(
      (entry) => (!kind || entry.kind === kind) && (!ownerId || entry.ownerId === ownerId),
    );
  }

  function createEntry(params: QueueEntryInput<Kind>) {
    const createdAt = getNowIsoString();
    return {
      attemptCount: 0,
      createdAt,
      id: params.id,
      kind: params.kind,
      maxAttempts: normalizeMaxAttempts(params.maxAttempts, options.defaultMaxAttempts),
      nextProcessAt: createdAt,
      ownerId: normalizeOwnerId(params.ownerId),
      payload: params.payload,
      schemaVersion: options.schemaVersion,
      status: options.pendingStatus,
      terminalAt: null,
      updatedAt: createdAt,
    } as Entry;
  }

  function assertCompatibleEntry(current: Entry, params: QueueEntryInput<Kind>) {
    if (
      current.kind !== params.kind ||
      normalizeOwnerId(current.ownerId) !== normalizeOwnerId(params.ownerId)
    ) {
      throw new Error("Queue entry id already belongs to another action.");
    }
  }

  async function persistNewEntryUnlocked(entry: Entry) {
    const existingIds = await readIndexUnlocked();
    if (!existingIds.includes(entry.id)) {
      await writeIndexUnlocked([...existingIds, entry.id]);
    }
    await writeEntryUnlocked(entry);
  }

  async function enqueue(params: QueueEntryInput<Kind>) {
    return runSerialized(async () => {
      const entry = createEntry(params);
      await persistNewEntryUnlocked(entry);
      return entry;
    });
  }

  async function enqueueOrPatch(
    params: QueueEntryInput<Kind>,
    patchExisting: (entry: Entry) => PersistentQueueEntryPatch<Kind, Status>,
  ) {
    return runSerialized(async () => {
      const normalizedId = String(params.id || "").trim();
      if (!normalizedId) throw new Error("Queue entry id is required.");

      const current = await readEntryUnlocked(normalizedId);
      if (!current) {
        const entry = createEntry({ ...params, id: normalizedId });
        await persistNewEntryUnlocked(entry);
        return { created: true, entry };
      }

      assertCompatibleEntry(current, params);
      const nextEntry = normalizeEntry(
        {
          ...current,
          ...patchExisting(current),
          updatedAt: getNowIsoString(),
        } as Entry,
        options,
      ).entry;
      await writeEntryUnlocked(nextEntry);
      const existingIds = await readIndexUnlocked();
      if (!existingIds.includes(nextEntry.id)) {
        await writeIndexUnlocked([...existingIds, nextEntry.id]);
      }
      return { created: false, entry: nextEntry };
    });
  }

  async function patchEntry(entryId: string, patch: PersistentQueueEntryPatch<Kind, Status>) {
    const normalizedId = String(entryId || "").trim();
    if (!normalizedId) return null;

    return runSerialized(async () => {
      const current = await readEntryUnlocked(normalizedId);
      if (!current) return null;
      const nextEntry = normalizeEntry(
        {
          ...current,
          ...patch,
          updatedAt: getNowIsoString(),
        } as Entry,
        options,
      ).entry;
      await writeEntryUnlocked(nextEntry);

      const existingIds = await readIndexUnlocked();
      if (!existingIds.includes(nextEntry.id)) {
        await writeIndexUnlocked([...existingIds, nextEntry.id]);
      }
      if (nextEntry.id !== normalizedId) {
        await removeEntryUnlocked(normalizedId);
        await writeIndexUnlocked(
          existingIds.filter((item) => item !== normalizedId).concat(nextEntry.id),
        );
      }
      return nextEntry;
    });
  }

  async function getEntry(entryId: string) {
    const normalizedId = String(entryId || "").trim();
    if (!normalizedId) return null;

    try {
      return await runSerialized(async () => {
        const entry = await readEntryUnlocked(normalizedId);
        if (!entry) return null;
        const normalized = normalizeEntry(entry, options);
        if (normalized.mutated) {
          await writeEntryUnlocked(normalized.entry);
        }
        return normalized.entry;
      });
    } catch (error) {
      options.logReadError?.(error);
      return null;
    }
  }

  async function removeEntry(entryId: string) {
    const normalizedId = String(entryId || "").trim();
    if (!normalizedId) return;

    await runSerialized(async () => {
      const existingIds = await readIndexUnlocked();
      await removeEntryUnlocked(normalizedId);
      await writeIndexUnlocked(existingIds.filter((item) => item !== normalizedId));
    });
  }

  async function retryEntry(entryId: string) {
    return patchEntry(entryId, {
      attemptCount: 0,
      errorMessage: undefined,
      nextProcessAt: getNowIsoString(),
      status: options.pendingStatus,
      terminalAt: null,
    });
  }

  async function clearStorage() {
    await runSerialized(async () => {
      const existingIds = await readIndexUnlocked();
      for (const entryId of existingIds) {
        await removeEntryUnlocked(entryId);
      }
      await secureTextStorage.removeItem(indexStorageKey);
    });
  }

  return {
    clearStorage,
    enqueue,
    enqueueOrPatch,
    getEntry,
    getQueue,
    patchEntry,
    readAllEntries,
    removeEntry,
    retryEntry,
    writeAllEntries,
  };
}
