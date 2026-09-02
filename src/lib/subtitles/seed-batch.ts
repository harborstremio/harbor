/**
 * Collects independently prepared player-source subtitles and publishes them only
 * after the caller has settled the complete seed batch. The original source order
 * is retained even when preparation finishes out of order.
 */
export class PreparedSubtitleSeedBatch<T> {
  private readonly ready = new Set<T>();
  private committed = false;
  private readonly orderedSeeds: readonly T[];

  constructor(orderedSeeds: readonly T[]) {
    this.orderedSeeds = orderedSeeds;
  }

  markReady(seed: T): void {
    if (!this.committed) this.ready.add(seed);
  }

  commit(isCurrent: () => boolean, publish: (readySeeds: readonly T[]) => void): boolean {
    if (this.committed || !isCurrent()) return false;
    this.committed = true;
    publish(this.orderedSeeds.filter((seed) => this.ready.has(seed)));
    return true;
  }
}
