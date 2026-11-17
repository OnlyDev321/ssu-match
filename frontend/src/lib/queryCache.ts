export interface QueryCacheSnapshot<T> {
  data: T | null;
  error: unknown | null;
  updatedAt: number;
  isFetching: boolean;
}

const EMPTY_SNAPSHOT: QueryCacheSnapshot<never> = {
  data: null,
  error: null,
  updatedAt: 0,
  isFetching: false,
};

export function getEmptyQuerySnapshot<T>(): QueryCacheSnapshot<T> {
  return EMPTY_SNAPSHOT as QueryCacheSnapshot<T>;
}

const cache = new Map<string, QueryCacheSnapshot<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const inFlight = new Map<string, Promise<unknown>>();
const requestVersions = new Map<string, number>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

export function getQuerySnapshot<T>(key: string): QueryCacheSnapshot<T> {
  return (cache.get(key) as QueryCacheSnapshot<T> | undefined) ?? EMPTY_SNAPSHOT as QueryCacheSnapshot<T>;
}

export function updateCachedQuery<T>(key: string, updater: (previous: T | null) => T | null) {
  const current = getQuerySnapshot<T>(key);
  requestVersions.set(key, (requestVersions.get(key) ?? 0) + 1);
  inFlight.delete(key);
  cache.set(key, { data: updater(current.data), error: null, updatedAt: Date.now(), isFetching: false });
  notify(key);
}

export function subscribeQuery(key: string, listener: () => void) {
  const keyListeners = listeners.get(key) ?? new Set<() => void>();
  keyListeners.add(listener);
  listeners.set(key, keyListeners);
  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0) listeners.delete(key);
  };
}

export function fetchCachedQuery<T>(
  key: string,
  load: () => Promise<T>,
  staleTimeMs: number,
  force = false,
): Promise<T> {
  const current = getQuerySnapshot<T>(key);
  if (!force && current.updatedAt > 0 && Date.now() - current.updatedAt < staleTimeMs) {
    return current.data !== null ? Promise.resolve(current.data) : Promise.reject(current.error);
  }

  const activeRequest = inFlight.get(key) as Promise<T> | undefined;
  if (activeRequest) return activeRequest;

  const requestVersion = (requestVersions.get(key) ?? 0) + 1;
  requestVersions.set(key, requestVersion);
  cache.set(key, { ...current, isFetching: true, error: null });
  notify(key);

  const request = load()
    .then((data) => {
      if (requestVersions.get(key) === requestVersion) {
        cache.set(key, { data, error: null, updatedAt: Date.now(), isFetching: false });
        notify(key);
      }
      return data;
    })
    .catch((error: unknown) => {
      if (requestVersions.get(key) === requestVersion) {
        cache.set(key, { ...current, error, updatedAt: Date.now(), isFetching: false });
        notify(key);
      }
      throw error;
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

export function invalidateCachedQueries(prefix: string) {
  for (const [key, snapshot] of cache) {
    if (!key.startsWith(prefix)) continue;
    requestVersions.set(key, (requestVersions.get(key) ?? 0) + 1);
    inFlight.delete(key);
    cache.set(key, { ...snapshot, updatedAt: 0 });
    notify(key);
  }
}

export function clearCachedQueries(prefix: string) {
  const matchingKeys = new Set([...cache.keys(), ...inFlight.keys()]);
  for (const key of matchingKeys) {
    if (!key.startsWith(prefix)) continue;
    requestVersions.set(key, (requestVersions.get(key) ?? 0) + 1);
    inFlight.delete(key);
    cache.delete(key);
    notify(key);
  }
}
