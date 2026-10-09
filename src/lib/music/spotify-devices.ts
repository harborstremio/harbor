import { invoke } from "@tauri-apps/api/core";

export type SpotifyDevice = {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  restricted: boolean;
  volumePercent: number | null;
};

export function spotifyDevices(): Promise<SpotifyDevice[]> {
  return invoke<SpotifyDevice[]>("music_spotify_devices");
}

export function spotifyPlaybackTarget(): Promise<string | null> {
  return invoke<string | null>("music_spotify_device");
}

export function setSpotifyPlaybackTarget(device: string | null): Promise<void> {
  return invoke("music_spotify_set_device", { device });
}

/** Spotify refuses playback on a device it has marked restricted, so it cannot be a target. */
export function selectableSpotifyDevices(devices: readonly SpotifyDevice[]): SpotifyDevice[] {
  return devices.filter((device) => !device.restricted && device.id.trim().length > 0);
}
