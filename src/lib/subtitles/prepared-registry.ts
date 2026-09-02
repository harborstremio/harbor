import type { PreparedSubtitle } from "./prepare";

const pendingPrepared = new Map<string, PreparedSubtitle>();

export function registerPreparedSubtitle(prepared: PreparedSubtitle): void {
  const previous = pendingPrepared.get(prepared.playableUrl);
  previous?.cleanup();
  pendingPrepared.set(prepared.playableUrl, prepared);
}

export function takePreparedSubtitle(url: string): PreparedSubtitle | null {
  const prepared = pendingPrepared.get(url) ?? null;
  pendingPrepared.delete(url);
  return prepared;
}

export function takePreparedSubtitleCleanup(url: string): (() => void) | null {
  return takePreparedSubtitle(url)?.cleanup ?? null;
}

export function discardPreparedSubtitle(prepared: PreparedSubtitle): void {
  pendingPrepared.delete(prepared.playableUrl);
  prepared.cleanup();
}
