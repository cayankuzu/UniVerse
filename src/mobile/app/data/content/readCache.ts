export type TimedReadCacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T> | null;
  value: T | null;
};

export function resetTimedReadCacheEntry<T>(entry: TimedReadCacheEntry<T>) {
  entry.expiresAt = 0;
  entry.promise = null;
  entry.value = null;
}

function isFresh(expiresAt: number) {
  return expiresAt > Date.now();
}

function cloneCachedValue<T>(value: T, clone?: (nextValue: T) => T) {
  return clone ? clone(value) : value;
}

export async function readTimedReadCacheValue<T>(params: {
  clone?: (value: T) => T;
  entry: TimedReadCacheEntry<T>;
  task: () => Promise<T>;
  ttlMs: number;
}) {
  const { clone, entry, task, ttlMs } = params;
  if (entry.promise && isFresh(entry.expiresAt)) {
    return cloneCachedValue(await entry.promise, clone);
  }
  if (entry.value !== null && isFresh(entry.expiresAt)) {
    return cloneCachedValue(entry.value, clone);
  }

  const nextPromise = task();
  entry.expiresAt = Date.now() + ttlMs;
  entry.promise = nextPromise;

  try {
    const resolvedValue = await nextPromise;
    entry.value = resolvedValue;
    entry.expiresAt = Date.now() + ttlMs;
    return cloneCachedValue(resolvedValue, clone);
  } catch (error) {
    resetTimedReadCacheEntry(entry);
    throw error;
  } finally {
    entry.promise = null;
  }
}

export async function readTimedReadMapCacheValue<T>(params: {
  cache: Map<string, TimedReadCacheEntry<T>>;
  clone: (value: T) => T;
  key: string;
  task: () => Promise<T>;
  ttlMs: number;
}) {
  const { cache, clone, key, task, ttlMs } = params;
  const cachedValue = cache.get(key);
  if (cachedValue && cachedValue.promise && isFresh(cachedValue.expiresAt)) {
    return clone(await cachedValue.promise);
  }
  if (cachedValue && cachedValue.value !== null && isFresh(cachedValue.expiresAt)) {
    return clone(cachedValue.value);
  }

  const nextPromise = task();
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    promise: nextPromise,
    value: null,
  });

  try {
    const resolvedValue = await nextPromise;
    cache.set(key, {
      expiresAt: Date.now() + ttlMs,
      promise: null,
      value: resolvedValue,
    });
    return clone(resolvedValue);
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}
