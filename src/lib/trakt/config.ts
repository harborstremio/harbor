export const TRAKT_API_BASE = "https://api.trakt.tv";
export const TRAKT_API_VERSION = "2";
export const TRAKT_CLIENT_ID =
  "71ef7ea86333eab031c8830f8200df1f2f16ef9a3335a67470be4950ac80b925";
export const TRAKT_TOKEN_PROXY = (import.meta.env.VITE_TRAKT_TOKEN_PROXY as string | undefined) || `${TRAKT_API_BASE}/oauth/token`;
export const TRAKT_DEVICE_TOKEN_PROXY = (import.meta.env.VITE_TRAKT_DEVICE_TOKEN_PROXY as string | undefined) || `${TRAKT_API_BASE}/oauth/device/token`;
export const TRAKT_VERIFY_URL = "https://trakt.tv/activate";
export const REFRESH_THRESHOLD_SEC = 14 * 24 * 60 * 60;
export const WRITE_MIN_INTERVAL_MS = 1000;
