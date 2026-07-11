const STORAGE_KEY = "harbor.player.volume.v1";

export type PlayerVolumePrefs = {
  volume: number;
  muted: boolean;
};

const DEFAULT: PlayerVolumePrefs = { volume: 1, muted: false };

export function readPlayerVolume(): PlayerVolumePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<PlayerVolumePrefs>;
    const volume =
      typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 6 ? parsed.volume : DEFAULT.volume;
    const muted = parsed.muted === true;
    return { volume, muted };
  } catch {
    return DEFAULT;
  }
}

export function writePlayerVolume(prefs: Partial<PlayerVolumePrefs>): void {
  try {
    const prev = readPlayerVolume();
    const next: PlayerVolumePrefs = {
      volume: typeof prefs.volume === "number" ? prefs.volume : prev.volume,
      muted: typeof prefs.muted === "boolean" ? prefs.muted : prev.muted,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
