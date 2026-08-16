export function coalesceKeyed<K, V>(
  inflight: Map<K, Promise<V>>,
  key: K,
  load: () => Promise<V>,
): Promise<V> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const pending = (async () => {
    try {
      return await load();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, pending);
  return pending;
}
