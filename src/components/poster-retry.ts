export const POSTER_RETRY_LIMIT = 5;
export const POSTER_RETRY_BASE_MS = 1_200;
export const POSTER_RETRY_COOLDOWN_MS = 10 * 60_000;

export class PosterRetryPolicy {
  private readonly cooldowns = new Map<string, number>();

  isCooling(url: string, now = Date.now()): boolean {
    const until = this.cooldowns.get(url);
    if (until === undefined) return false;
    if (until > now) return true;
    this.cooldowns.delete(url);
    return false;
  }

  cool(urls: string[], now = Date.now()): void {
    const until = now + POSTER_RETRY_COOLDOWN_MS;
    for (const url of urls) this.cooldowns.set(url, until);
  }

  clear(urls: string[]): void {
    for (const url of urls) this.cooldowns.delete(url);
  }

  delayFor(retry: number): number | null {
    if (retry >= POSTER_RETRY_LIMIT) return null;
    return POSTER_RETRY_BASE_MS * 2 ** retry;
  }

  canAutomaticallyRetry(urls: string[], retry: number, online: boolean): boolean {
    return online && this.delayFor(retry) !== null && !urls.some((url) => this.isCooling(url));
  }
}
