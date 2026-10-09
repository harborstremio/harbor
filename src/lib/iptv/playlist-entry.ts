import type { Settings } from "@/lib/settings";

export type PlaylistKind = "m3u" | "xtream" | "epg";

export type PlaylistFormValue = {
  name: string;
  kind: PlaylistKind;
  url: string;
  epgUrl: string;
  xtream: { server: string; username: string; password: string };
};

export type StoredPlaylist = Settings["iptvPlaylists"][number];

export const EMPTY_PLAYLIST_FORM: PlaylistFormValue = {
  name: "",
  kind: "m3u",
  url: "",
  epgUrl: "",
  xtream: { server: "", username: "", password: "" },
};

export function buildXtreamUrls(server: string, username: string, password: string) {
  const base = server.replace(/\/+$/, "");
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  return {
    m3u: `${base}/get.php?username=${u}&password=${p}&type=m3u_plus&output=ts`,
    epg: `${base}/xmltv.php?username=${u}&password=${p}`,
  };
}

/**
 * The one place a form value becomes a stored playlist. Big Picture's setup
 * screen and the desktop source picker both route through here so a playlist
 * added on a TV is byte-identical to the same playlist added on a desktop.
 */
export function materializePlaylistEntry(id: string, entry: PlaylistFormValue): StoredPlaylist {
  if (entry.kind === "xtream") {
    const { m3u, epg } = buildXtreamUrls(
      entry.xtream.server,
      entry.xtream.username,
      entry.xtream.password,
    );
    return {
      id,
      name: entry.name,
      url: m3u,
      epgUrl: epg,
      kind: "xtream",
      xtream: {
        server: entry.xtream.server.replace(/\/+$/, ""),
        username: entry.xtream.username,
        password: entry.xtream.password,
      },
    };
  }
  if (entry.kind === "epg") {
    return { id, name: entry.name, url: "", epgUrl: entry.epgUrl, kind: "epg" };
  }
  return { id, name: entry.name, url: entry.url, epgUrl: entry.epgUrl || undefined, kind: "m3u" };
}

export function newPlaylistId(): string {
  return `pl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
