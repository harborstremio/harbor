/** Owns prepared subtitle resources until the mpv media generation releases them. */
export class PreparedSubtitleCleanupRegistry {
  private readonly cleanups = new Map<() => void, number>();

  register(cleanup: () => void, mediaLoadId: number): void {
    this.cleanups.set(cleanup, mediaLoadId);
  }

  clearBefore(mediaLoadId: number): void {
    for (const [cleanup, ownerLoadId] of this.cleanups) {
      if (ownerLoadId >= mediaLoadId) continue;
      this.cleanups.delete(cleanup);
      try {
        cleanup();
      } catch {}
    }
  }

  clearAll(): void {
    for (const cleanup of this.cleanups.keys()) {
      this.cleanups.delete(cleanup);
      try {
        cleanup();
      } catch {}
    }
  }
}
