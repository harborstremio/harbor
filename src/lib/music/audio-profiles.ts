import { normalizeMusicAudio, type MusicAudioSettingsValue } from "./audio-settings";

export type ListeningProfile = { id: string; name: string; settings: MusicAudioSettingsValue };
const KEY = "harbor.music.listening-profiles.v1";
export const MAX_LISTENING_PROFILES = 20;

export function readListeningProfiles(): ListeningProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > 200000) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.slice(0, MAX_LISTENING_PROFILES).flatMap((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        seen.has(item.id)
      )
        return [];
      seen.add(item.id);
      return [
        {
          id: item.id.slice(0, 100),
          name: item.name.slice(0, 100),
          settings: normalizeMusicAudio(item.settings),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function writeListeningProfiles(profiles: ListeningProfile[]): void {
  // Do not report a saved equipment profile if persistent storage rejected it.
  localStorage.setItem(KEY, JSON.stringify(profiles.slice(0, MAX_LISTENING_PROFILES)));
}

export function loadListeningProfile(
  profile: ListeningProfile,
  current: MusicAudioSettingsValue,
): MusicAudioSettingsValue {
  // A correction profile must never silently change output routing or raise the volume ceiling.
  return normalizeMusicAudio({
    ...profile.settings,
    device: current.device,
    exclusive: current.exclusive,
    sampleRate: current.sampleRate,
    boostEnabled: current.boostEnabled,
    volumeLimit: current.volumeLimit,
  });
}
