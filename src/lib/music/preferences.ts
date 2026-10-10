const sessionPreferences = new Map<string, string>();

export function readMusicPreference(key: string): string | null {
  const current = sessionPreferences.get(key);
  if (current !== undefined) return current;
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) sessionPreferences.set(key, stored);
    return stored;
  } catch {
    return null;
  }
}

export function writeMusicPreference(key: string, value: string): void {
  // Keep the user's selection for this session even when browser storage is full or blocked.
  sessionPreferences.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Optional persistence must never prevent a playback control from taking effect.
  }
}
