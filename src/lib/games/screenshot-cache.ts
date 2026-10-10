import { GameRequestPool } from "./request-pool";

export const SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;
export type ScreenshotStore = { read: (key: string) => Promise<Blob | null>; write: (key: string, value: Blob) => Promise<void>; remove: (key: string) => Promise<void> };
type PendingImage = { controller: AbortController; users: number; done: boolean; promise: Promise<Blob> };

/** Public screenshot bytes only. Consumers share work, but cancel independently. */
export class ScreenshotCache {
  private pending = new Map<string, PendingImage>();
  private pool = new GameRequestPool(3);
  private store: ScreenshotStore;
  private fetch: (url: string, signal: AbortSignal) => Promise<Blob>;
  private validate: (blob: Blob) => Promise<Blob>;
  constructor(store: ScreenshotStore, fetch: (url: string, signal: AbortSignal) => Promise<Blob>, validate: (blob: Blob) => Promise<Blob>) { this.store = store; this.fetch = fetch; this.validate = validate; }

  invalidate(url: string) { return this.store.remove(url).catch(() => {}); }

  load(url: string, signal: AbortSignal): Promise<Blob> {
    signal.throwIfAborted();
    let task = this.pending.get(url);
    if (!task) {
      const controller = new AbortController();
      task = { controller, users: 0, done: false, promise: this.pool.run(() => this.read(url, controller.signal), controller.signal) };
      this.pending.set(url, task);
      const finish = () => { task!.done = true; if (this.pending.get(url) === task) this.pending.delete(url); };
      void task.promise.then(finish, finish);
    }
    const shared = task;
    shared.users++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const settle = (value?: Blob, error?: unknown) => {
        if (finished) return;
        finished = true; signal.removeEventListener("abort", abort); shared.users--;
        if (!shared.users && !shared.done) { if (this.pending.get(url) === shared) this.pending.delete(url); shared.controller.abort(); }
        if (value) resolve(value); else reject(error);
      };
      const abort = () => settle(undefined, signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      void shared.promise.then(value => settle(value), error => settle(undefined, error));
    });
  }

  private async read(url: string, signal: AbortSignal): Promise<Blob> {
    const held = await this.store.read(url).catch(() => null);
    signal.throwIfAborted();
    if (held) {
      try { const value = await this.checked(held); signal.throwIfAborted(); return value; }
      catch (error) { signal.throwIfAborted(); await this.invalidate(url); }
    }
    signal.throwIfAborted();
    const blob = await this.checked(await this.fetch(url, signal));
    signal.throwIfAborted();
    await this.store.write(url, blob).catch(() => {});
    signal.throwIfAborted();
    return blob;
  }

  private checked(blob: Blob) {
    if (!(blob instanceof Blob) || !blob.size || blob.size > SCREENSHOT_MAX_BYTES) return Promise.reject(new Error("Screenshot size unavailable"));
    return this.validate(blob);
  }
}
