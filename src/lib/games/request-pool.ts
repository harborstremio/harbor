/** Share a small network budget while removing superseded searches from the queue. */
export class GameRequestPool {
  private active = 0;
  private waiting: Array<() => void> = [];
  private interactive: Array<() => void> = [];
  private readonly limit: number;
  constructor(limit = 4) { this.limit = limit; }

  async run<T>(load: () => Promise<T>, signal?: AbortSignal, priority = false): Promise<T> {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const start = () => { signal?.removeEventListener("abort", cancel); this.active += 1; resolve(); };
      const cancel = () => { this.waiting = this.waiting.filter(item => item !== start); this.interactive = this.interactive.filter(item => item !== start); reject(signal?.reason ?? new DOMException("Aborted", "AbortError")); };
      if (this.active < this.limit) start();
      else { (priority ? this.interactive : this.waiting).push(start); signal?.addEventListener("abort", cancel, { once: true }); }
    });
    try { signal?.throwIfAborted(); return await load(); }
    finally { this.active -= 1; (this.interactive.shift() ?? this.waiting.shift())?.(); }
  }
}
