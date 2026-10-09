import type { SourceIndex } from './source-index';

export const SOURCE_INDEX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_INDEXES = 128;

/** Tokens never point back to entry arrays. Eviction releases an index even while
 * a view still holds its catalog; shared snapshots count the same buffers once. */
export function createSourceIndexCache(maxBytes = SOURCE_INDEX_CACHE_BYTES, maxIndexes = MAX_INDEXES) {
  const owners = new WeakMap<object, object>(), identities = new WeakMap<SourceIndex, object>();
  const held = new Map<object, { index: SourceIndex; bytes: number }>();
  let bytes = 0;
  function remove(token: object) {
    const item = held.get(token);
    if (item) { bytes -= item.bytes; held.delete(token); }
  }
  return {
    get(owner: object) {
      const token = owners.get(owner), item = token && held.get(token);
      if (!item || !token) return;
      held.delete(token); held.set(token, item);
      return item.index;
    },
    remember(owner: object, index: SourceIndex) {
      // Account for backing allocations, including views over larger buffers.
      const size = index.keys.buffer.byteLength + (index.rows.buffer === index.keys.buffer ? 0 : index.rows.buffer.byteLength);
      owners.delete(owner);
      if (size > maxBytes) return;
      let token = identities.get(index);
      if (!token) { token = {}; identities.set(index, token); }
      remove(token); held.set(token, { index, bytes: size }); bytes += size; owners.set(owner, token);
      while (bytes > maxBytes || held.size > maxIndexes) remove(held.keys().next().value!);
    },
  };
}
