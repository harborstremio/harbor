const MUTED_KEY = "harbor.hero-muted.v1";
const AUDIO_KEY = "harbor.hero-known-audio.v1";

function readFlag(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    return null;
  }
  return null;
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* persistence is best-effort */
  }
}

let muted = readFlag(MUTED_KEY) ?? true;
let knownAudio: boolean | null = readFlag(AUDIO_KEY);
const subs = new Set<() => void>();

export function getHeroMuted(): boolean {
  return muted;
}

export function setHeroMuted(next: boolean): void {
  if (muted === next) return;
  muted = next;
  writeFlag(MUTED_KEY, next);
  for (const fn of subs) fn();
}

export function syncHeroMutedFromSetting(audioOn: boolean): void {
  if (knownAudio === audioOn) return;
  knownAudio = audioOn;
  writeFlag(AUDIO_KEY, audioOn);
  setHeroMuted(!audioOn);
}

export function subscribeHeroMuted(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
