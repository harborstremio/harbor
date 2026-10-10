import type { MetadataEntry } from "./metadata-store";
import { decodeGameMetadata, markSavedMetadata, savedMetadataAt } from "./metadata-records";

export const METADATA_FRESH_MS = 15 * 60_000;
export const METADATA_MAX_AGE = 7 * 86400_000;
type Store = { read: (key: string) => Promise<MetadataEntry | null>; write: (key: string, entry: MetadataEntry) => Promise<void> };

export class GameMetadataCache {
  private memory = new Map<string, MetadataEntry>();
  private pending = new Map<string, Promise<unknown>>();
  private store: Store;
  private now: () => number;
  private online: () => boolean;
  private freshFor: number;
  constructor(store: Store, now = Date.now, online = () => typeof navigator === "undefined" || navigator.onLine !== false, freshFor = METADATA_FRESH_MS) {
    this.store = store; this.now = now; this.online = online; this.freshFor = freshFor;
  }

  private valid(key: string, entry: MetadataEntry | null): MetadataEntry | null {
    if (!entry || !Number.isFinite(entry.at) || entry.at > this.now() + 60_000 || this.now() - entry.at > METADATA_MAX_AGE) return null;
    const data = decodeGameMetadata(key, entry.data);
    return data !== null ? { at: entry.at, data } : null;
  }

  private remember(key: string, entry: MetadataEntry) {
    this.memory.delete(key); this.memory.set(key, entry);
    if (this.memory.size > 80) this.memory.delete(this.memory.keys().next().value!);
  }

  /** A saved snapshot is optional: storage failure cannot prevent a network load. */
  async peek<T>(key: string): Promise<T | null> {
    const entry = this.valid(key, this.memory.get(key) ?? await this.store.read(key).catch(() => null));
    return entry ? markSavedMetadata(entry.data as T, entry.at) : null;
  }

  load<T>(key: string, fetch: () => Promise<T>, signal?: AbortSignal, force = false): Promise<T> {
    if (!signal && !force) { const pending = this.pending.get(key); if (pending) return pending as Promise<T>; }
    const task = this.run(key, fetch, signal, force);
    if (!signal && !force) { this.pending.set(key, task); void task.then(() => this.pending.delete(key), () => this.pending.delete(key)); }
    return task;
  }

  private async run<T>(key: string, fetch: () => Promise<T>, signal?: AbortSignal, force = false): Promise<T> {
    signal?.throwIfAborted();
    const held = this.valid(key, this.memory.get(key) ?? await this.store.read(key).catch(() => null));
    signal?.throwIfAborted();
    if (held) {
      this.remember(key, held);
      if (!this.online()) return markSavedMetadata(held.data as T, held.at);
      if (!force && this.now() - held.at < this.freshFor) return held.data as T;
    }
    try {
      const value = await fetch();
      signal?.throwIfAborted();
      // A partial response built from an older cached child must never gain a new age.
      if (savedMetadataAt(value) === undefined) {
        const entry = { at: this.now(), data: value };
        this.remember(key, entry);
        if (decodeGameMetadata(key, value) !== null) void this.store.write(key, entry).catch(() => {});
      }
      return value;
    } catch (error) {
      signal?.throwIfAborted();
      if (held) return markSavedMetadata(held.data as T, held.at);
      throw error;
    }
  }
}
