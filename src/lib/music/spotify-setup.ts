// Keep in sync with REDIRECT_PORT and redirect_uri in src-tauri/src/music/spotify/auth.rs.
export const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:8898/login";
export const SPOTIFY_DASHBOARD_URL = "https://developer.spotify.com/dashboard";

/** Replace backend setup instructions with localized, actionable form guidance. */
export function spotifySetupErrorKey(error: string): string | null {
  if (error.includes("Spotify needs your own client id")) return "music.spotifySetup.missingSaved";
  if (error.includes("Spotify rejected that client id")) return "music.spotifySetup.rejected";
  return null;
}
