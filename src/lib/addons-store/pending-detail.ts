type PendingAddon = { manifestUrl: string; manifest: unknown };

const pending = new Map<string, PendingAddon>();

export function rememberPendingAddon(id: string, manifestUrl: string, manifest: unknown): void {
  if (!id || !manifestUrl) return;
  pending.set(id, { manifestUrl, manifest });
  if (pending.size > 60) {
    const oldest = pending.keys().next().value;
    if (oldest) pending.delete(oldest);
  }
}

export function recallPendingAddon(id: string): PendingAddon | null {
  return pending.get(id) ?? null;
}
