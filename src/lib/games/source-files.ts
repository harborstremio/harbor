import { normalizeMagnet, MAGNET_MAX_TRACKERS } from './magnet';
import type { SourceFile } from './sources';

export function sourceFileIdentity(file: SourceFile): string {
  const magnet = file.kind === 'magnet' ? normalizeMagnet(file.url) : undefined;
  return magnet ? new URL(magnet).searchParams.get('xt')! : file.url;
}

/** Trackers are discovery hints, not separate downloads. Keep distinct payloads and file keys. */
export function uniqueSourceFiles(files: readonly SourceFile[]): SourceFile[] {
  const unique = new Map<string, SourceFile>();
  for (const file of files) {
    const magnet = file.kind === 'magnet' ? normalizeMagnet(file.url) : undefined;
    const params = magnet ? new URL(magnet).searchParams : undefined;
    const key = params?.get('xt') ?? file.url;
    const previous = unique.get(key);
    if (!previous) { unique.set(key, magnet ? { ...file, url: magnet } : file); continue; }
    if (!params || previous.kind !== 'magnet') continue;
    const merged = new URL(previous.url);
    const trackers = new Set(merged.searchParams.getAll('tr'));
    for (const tracker of params.getAll('tr')) {
      if (trackers.size >= MAGNET_MAX_TRACKERS) break;
      if (!trackers.has(tracker)) { trackers.add(tracker); merged.searchParams.append('tr', tracker); }
    }
    // Keep the first valid link if combining valid hints would exceed the URL budget.
    unique.set(key, { ...previous, url: normalizeMagnet(merged.href) ?? previous.url });
  }
  return [...unique.values()];
}
