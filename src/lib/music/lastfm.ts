import { invoke } from "@tauri-apps/api/core";

export const LASTFM_API_KEY = "harbor.lastfm.v1.apiKey";
export const LASTFM_API_SECRET = "harbor.lastfm.v1.apiSecret";
export const LASTFM_SESSION_KEY = "harbor.lastfm.v1.sessionKey";
export const LASTFM_USERNAME = "harbor.lastfm.v1.username";

export type LastFmAuthStart = {
  token: string;
  authUrl: string;
};

export type LastFmSession = {
  username: string;
  sessionKey: string;
};

export type LastFmStatus = {
  connected: boolean;
  username: string | null;
};

export function startLastFmAuth(apiKey: string, apiSecret: string): Promise<LastFmAuthStart> {
  return invoke<LastFmAuthStart>("music_lastfm_auth", { apiKey, apiSecret });
}

export function completeLastFmAuth(
  apiKey: string,
  apiSecret: string,
  token: string,
): Promise<LastFmSession> {
  return invoke<LastFmSession>("music_lastfm_complete_auth", {
    apiKey,
    apiSecret,
    token,
  });
}

export function getLastFmStatus(): Promise<LastFmStatus> {
  return invoke<LastFmStatus>("music_lastfm_status");
}
