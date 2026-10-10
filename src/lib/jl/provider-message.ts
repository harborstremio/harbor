import { credsFromServer, parseXtreamUrl } from "../iptv/xtream.ts";

/**
 * Reads the "access details" message an IPTV provider sends after purchase (WhatsApp, email,
 * Telegram) and turns it into logins the app can test. Providers vary the wording, emoji and
 * order, but every message carries a username, a password and one or more server or M3U links.
 */

export type ProviderLogin =
  | { kind: "xtream"; server: string; username: string; password: string; note: string | null }
  | { kind: "m3u"; url: string; note: string | null };

export type ProviderDetails = {
  username: string | null;
  password: string | null;
  /** Best login first. */
  logins: ProviderLogin[];
};

const URL_RX = /https?:\/\/[^\s<>"'`]+/gi;
// A label at the start of a line (after emoji or bullets), never inside a URL query string.
const USER_RX = /^[^\p{L}\p{N}]*(?:user\s*name|username|user|login)\s*[:\-–—]\s*(.+)$/iu;
const PASS_RX = /^[^\p{L}\p{N}]*(?:password|pass(?:word)?|pwd|pw)\s*[:\-–—]\s*(.+)$/iu;
const NOTE_RX = /\(([^)]{2,40})\)/;

function cleanUrl(raw: string): string {
  return raw.replace(/[),.;!?\]]+$/, "");
}

function isPlaylistUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /get\.php$/i.test(u.pathname) || /\.m3u8?$/i.test(u.pathname) || /type=m3u/i.test(u.search);
  } catch {
    return false;
  }
}

function firstToken(value: string): string {
  return value.trim().split(/\s+/)[0] ?? "";
}

export function parseProviderMessage(text: string): ProviderDetails {
  let username: string | null = null;
  let password: string | null = null;
  const servers: Array<{ url: string; note: string | null }> = [];
  const playlists: Array<{ url: string; note: string | null }> = [];
  // A heading like "M3U Playlist (VPN Supported):" labels the link on the next line.
  let pendingNote: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const urls = (trimmed.match(URL_RX) ?? []).map(cleanUrl);
    const note = trimmed.match(NOTE_RX)?.[1]?.trim() ?? null;

    if (urls.length === 0) {
      const user = trimmed.match(USER_RX);
      const pass = trimmed.match(PASS_RX);
      if (user && !username) username = firstToken(user[1]);
      else if (pass && !password) password = firstToken(pass[1]);
      else pendingNote = note;
      continue;
    }
    for (const url of urls) {
      const entry = { url, note: note ?? pendingNote };
      (isPlaylistUrl(url) ? playlists : servers).push(entry);
    }
    pendingNote = null;
  }

  const logins: ProviderLogin[] = [];
  const seen = new Set<string>();
  const addXtream = (server: string, user: string, pass: string, note: string | null) => {
    const creds = credsFromServer(server, user, pass);
    if (!creds) return;
    const key = `${creds.base}|${creds.username}`;
    if (seen.has(key)) return;
    seen.add(key);
    logins.push({ kind: "xtream", server: creds.base, username: creds.username, password: creds.password, note });
  };

  // Playlist links built on get.php carry the login, so they're the most reliable source.
  for (const p of playlists) {
    const creds = parseXtreamUrl(p.url);
    if (!creds) continue;
    username ??= creds.username;
    password ??= creds.password;
    addXtream(creds.base, creds.username, creds.password, p.note);
  }
  if (username && password) {
    for (const s of servers) addXtream(s.url, username, password, s.note);
  }
  for (const p of playlists) {
    if (parseXtreamUrl(p.url)) continue;
    logins.push({ kind: "m3u", url: p.url, note: p.note });
  }
  return { username, password, logins };
}
