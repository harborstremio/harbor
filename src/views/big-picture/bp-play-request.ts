const TTL_MS = 15_000;

export type BpResumeAt = { season: number; episode: number };
export type BpPlayIntent = { resumeAt: BpResumeAt | null };

let pending: { metaId: string; at: number; resumeAt: BpResumeAt | null } | null = null;
let version = 0;
const listeners = new Set<() => void>();

// The quick panel unmounts before the detail route it navigates to has mounted,
// so a play press cannot hand its intent over as a prop.
//
// resumeAt is the caller naming the exact episode it meant. Without it BpDetail
// has to re-derive the resume point from an uncached libraryGetOne, and when
// that request loses a 500ms race it falls back to the premiere, autoplays it
// under instantPlay, and use-stremio-sync then writes S1E1 over the real resume
// point in Stremio cloud. Unrecoverable, and it propagates to every device. Any
// caller that already knows the episode must say so here.
export function requestBpPlay(metaId: string, resumeAt?: BpResumeAt | null): void {
  pending = { metaId, at: Date.now(), resumeAt: resumeAt ?? null };
  version += 1;
  for (const fn of listeners) fn();
}

export function subscribeBpPlay(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function bpPlayVersion(): number {
  return version;
}

export function bpPlayPending(metaId: string): boolean {
  if (!pending) return false;
  if (pending.metaId !== metaId) return false;
  if (Date.now() - pending.at > TTL_MS) {
    pending = null;
    return false;
  }
  return true;
}

/** Non-consuming peek. The pending effect needs the hint to size its wait. */
export function bpPlayResumeAt(metaId: string): BpResumeAt | null {
  return bpPlayPending(metaId) ? (pending?.resumeAt ?? null) : null;
}

// Deliberately not named takeBpPlay. The old name returned a bare boolean and
// silently discarded the resume hint, so a consumer restored from an older copy
// of BpDetail would reintroduce the S1E1 overwrite with a green build. Renaming
// makes that regression a compile error instead of a data-loss bug.
export function takeBpPlayIntent(metaId: string): BpPlayIntent | null {
  if (!bpPlayPending(metaId)) return null;
  const intent: BpPlayIntent = { resumeAt: pending?.resumeAt ?? null };
  pending = null;
  return intent;
}
