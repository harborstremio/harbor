import { getStremioServerUrl, remoteStreamServerUrl } from "@/lib/stremio-server";
import { engineToken, isLocalEngineBase, primeEngineToken, withEngineToken } from "./engine-token";

export type TorrentFile = {
  idx: number;
  name: string;
  length: number;
};

type RawFile = {
  name?: string;
  path?: string;
  length?: number;
  size?: number;
  idx?: number;
};

const VIDEO_EXT = /\.(mkv|mp4|m4v|avi|mov|webm|ts|wmv|flv|mpg|mpeg|m2ts)$/i;

export function trackersFromSources(sources?: string[]): string[] {
  if (!sources) return [];
  const out: string[] = [];
  for (const s of sources) {
    if (s.startsWith("tracker:")) out.push(s.slice(8));
    else if (s.startsWith("dht:")) continue;
    else if (/^(udp|https?|wss?):\/\//.test(s)) out.push(s);
  }
  return out;
}

export function buildTorrentStreamUrl(opts: {
  infoHash: string;
  fileIdx?: number | null;
  sources?: string[];
  trackers?: string[];
  filename?: string | null;
  base?: string;
}): string {
  const idx = opts.fileIdx == null || opts.fileIdx < 0 ? -1 : opts.fileIdx;
  const params = new URLSearchParams();
  const trackers = opts.trackers ?? trackersFromSources(opts.sources);
  for (const t of trackers) params.append("tr", t);
  if (opts.filename) params.set("f", opts.filename);
  const base = opts.base ?? getStremioServerUrl();
  // This route adds the torrent, so the bundled engine requires its key. Call
  // `primeEngineToken()` on the async path that leads here.
  if (isLocalEngineBase(base) && engineToken()) params.set("tok", engineToken());
  const qs = params.toString();
  return `${base}/${opts.infoHash.toLowerCase()}/${idx}${qs ? `?${qs}` : ""}`;
}

export function isVideoFile(f: TorrentFile): boolean {
  return VIDEO_EXT.test(f.name);
}

export type CreatedTorrent = { files: TorrentFile[]; guessedFileIdx: number | null };

export async function createAndListFiles(
  infoHash: string,
  trackers: string[],
  seriesInfo?: { season?: number | null; episode?: number | null } | null,
  timeoutMs = 15000,
  base?: string,
): Promise<CreatedTorrent | null> {
  const hash = infoHash.toLowerCase();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  const guessFileIdx =
    seriesInfo && seriesInfo.season != null && seriesInfo.episode != null
      ? { season: seriesInfo.season, episode: seriesInfo.episode }
      : {};
  const target = base ?? getStremioServerUrl();
  const createUrl = isLocalEngineBase(target)
    ? withEngineToken(`${target}/${hash}/create`, await primeEngineToken())
    : `${target}/${hash}/create`;
  try {
    const res = await fetch(createUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        torrent: { infoHash: hash },
        peerSearch: { sources: [`dht:${hash}`, ...trackers], min: 40, max: 200 },
        guessFileIdx,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      files?: RawFile[];
      torrent?: { files?: RawFile[] };
      guessedFileIdx?: number;
    };
    const raw = json.files ?? json.torrent?.files;
    if (!Array.isArray(raw)) return null;
    const files = raw.map((f, idx) => ({
      idx: typeof f.idx === "number" ? f.idx : idx,
      name: fileName(f),
      length: Number(f.length ?? f.size ?? 0) || 0,
    }));
    const guessedFileIdx =
      typeof json.guessedFileIdx === "number" && json.guessedFileIdx >= 0
        ? json.guessedFileIdx
        : null;
    return { files, guessedFileIdx };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function fileName(f: RawFile): string {
  if (f.name) return f.name;
  if (f.path) {
    const parts = f.path.split(/[\\/]/);
    return parts[parts.length - 1] || f.path;
  }
  return "Unknown file";
}

export function localTorrentAllowed(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return true;
    return (JSON.parse(raw) as { directTorrentStream?: boolean }).directTorrentStream !== false;
  } catch {
    return true;
  }
}

/// Hard kill-switch for torrent streaming. When this returns `true`, the
/// torrent engine is not started, DHT/tracker traffic is disabled, and the
/// picker will never call into the engine. The user must explicitly opt back
/// in via Settings → Player.
export function torrentsDisabled(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return false;
    return (JSON.parse(raw) as { torrentsDisabled?: boolean }).torrentsDisabled === true;
  } catch {
    return false;
  }
}

export function directTorrentEnabled(): boolean {
  if (torrentsDisabled()) return false;
  if (remoteStreamServerUrl()) return true;
  return localTorrentAllowed();
}

export function directStreamAvailable(stream: { infoHash?: string | null }): boolean {
  if (torrentsDisabled()) return false;
  if (!stream.infoHash) return false;
  if (!("__TAURI_INTERNALS__" in window)) return false;
  return directTorrentEnabled();
}

const P2P_MIN_SEEDERS = 2;

export function engineP2pEligible(stream: {
  infoHash?: string | null;
  seeders?: number | null;
}): boolean {
  if (torrentsDisabled()) return false;
  if (!directStreamAvailable(stream)) return false;
  if (stream.seeders != null && stream.seeders < P2P_MIN_SEEDERS) return false;
  return true;
}
