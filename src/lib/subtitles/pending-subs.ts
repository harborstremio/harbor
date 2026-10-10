// A provider-derived subtitle URL whose download returned a not-ready payload
// (for example an AI-translation addon answering with a "translation in progress"
// placeholder). This is a pending job, not a failure: the same URL is expected to
// serve the finished subtitle later, so callers surface "try again shortly"
// instead of "couldn't add". The placeholder bytes are never played.
const pending = new Set<string>();

export function markPendingSub(url: string): void {
  if (url) pending.add(url);
}

export function clearPendingSub(url: string): void {
  if (url) pending.delete(url);
}

export function wasPendingSub(url: string): boolean {
  return pending.has(url);
}
