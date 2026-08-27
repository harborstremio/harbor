import { AlertCircle, FileVideo, Loader2, Magnet, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { parse } from "parse-torrent-title";
import { awaitCastServerReady, remoteStreamServerUrl } from "@/lib/stremio-server";
import { parseMagnet } from "@/lib/torrent/magnet";
import {
  buildTorrentStreamUrl,
  createAndListFiles,
  isVideoFile,
  type TorrentFile,
} from "@/lib/torrent/stremio-stream";
import {
  lastEngineAddError,
  scheduleAbandonedTorrentRemoval,
  torrentEngineAdd,
  torrentEngineSelect,
  torrentEngineStatus,
  type AddResult,
} from "@/lib/torrent/local-engine";
import { searchCinemeta } from "@/lib/search";
import { meta as fetchMeta, type Meta } from "@/lib/cinemeta";
import { ResultPoster } from "./result-poster";
import { useView, type PlayerSrc } from "@/lib/view";

import { releaseYear } from "@/lib/release-info";
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Mode = "idle" | "starting" | "picking" | "error";

type MagnetMatch = {
  meta: Meta;
  season: number | null;
  episode: number | null;
  episodeName?: string;
};

export function MagnetCard({ raw, onClose }: { raw: string; onClose: () => void }) {
  const { openPlayer } = useView();
  const parsed = useMemo(() => parseMagnet(raw), [raw]);
  const [mode, setMode] = useState<Mode>("idle");
  const [files, setFiles] = useState<TorrentFile[]>([]);
  const [engine, setEngine] = useState<AddResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<MagnetMatch | null>(null);
  const matchRef = useRef<MagnetMatch | null>(null);
  const pendingEngineRef = useRef<string | null>(null);
  matchRef.current = match;

  useEffect(
    () => () => {
      const infoHash = pendingEngineRef.current;
      if (infoHash) scheduleAbandonedTorrentRemoval(infoHash, 0);
    },
    [],
  );

  const dn = parsed?.name ?? null;
  const label = useMemo(() => cleanReleaseName(dn), [dn]);

  useEffect(() => {
    setMatch(null);
    if (!dn) return;
    let alive = true;
    void resolveMagnetMeta(dn).then((m) => {
      if (alive && m) setMatch(m);
    });
    return () => {
      alive = false;
    };
  }, [dn]);

  if (!parsed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-edge-soft bg-elevated/60 px-5 py-4">
        <AlertCircle size={22} className="shrink-0 text-ink-subtle" />
        <span className="text-[14px] text-ink-muted">
          That does not look like a valid magnet link or infohash.
        </span>
      </div>
    );
  }

  const startPlay = async (fileIdx: number | null, name?: string, engineOverride?: AddResult) => {
    let url: string;
    const activeEngine = engineOverride ?? engine;
    if (activeEngine) {
      const idx = fileIdx ?? 0;
      await torrentEngineSelect(activeEngine.info_hash, idx);
      url = `${activeEngine.stream_base}/${activeEngine.info_hash.toLowerCase()}/${idx}`;
    } else {
      url = buildTorrentStreamUrl({
        infoHash: parsed.infoHash,
        fileIdx,
        trackers: parsed.trackers,
        filename: name ?? null,
      });
    }
    const m = matchRef.current;
    const playMeta: Meta = m?.meta ?? {
      id: `magnet:${parsed.infoHash}`,
      type: "movie",
      name: label,
    };
    const src: PlayerSrc = {
      meta: playMeta,
      url,
      title: m?.meta.name ?? name ?? label,
      subtitle: episodeLine(m),
      streamRef: { infoHash: parsed.infoHash, fileIdx: fileIdx ?? null },
    };
    pendingEngineRef.current = null;
    onClose();
    openPlayer(src);
  };

  const onPlay = async () => {
    setMode("starting");
    setError(null);

    if (remoteStreamServerUrl()) {
      const ready = await awaitCastServerReady(8000);
      if (!ready) {
        setMode("error");
        setError("Your remote streaming server is not reachable. Check its address in Settings.");
        return;
      }
      const created = await createAndListFiles(parsed.infoHash, parsed.trackers);
      const videos = (created?.files ?? []).filter(isVideoFile).sort((a, b) => b.length - a.length);
      if (videos.length === 0) {
        setMode("error");
        setError("No playable video file was found in this torrent.");
        return;
      }
      if (videos.length > 1) {
        setFiles(videos);
        setMode("picking");
        return;
      }
      void startPlay(videos[0]?.idx ?? null, videos[0]?.name);
      return;
    }

    if (!isTauri) {
      setMode("error");
      setError("Direct torrent play needs the Harbor desktop app.");
      return;
    }

    let status = await torrentEngineStatus();
    if (!status?.ready) {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && !status?.ready) {
        await new Promise((r) => window.setTimeout(r, 300));
        status = await torrentEngineStatus();
      }
    }
    if (!status?.ready) {
      setMode("error");
      setError("The streaming engine is still starting up. Give it a moment and press Play again.");
      return;
    }

    setEngine(null);
    const added = await torrentEngineAdd(raw, parsed.trackers);
    if (!added || added.files.length === 0) {
      setMode("error");
      const e = lastEngineAddError();
      setError(
        e && /peer|timed out|timeout/i.test(e)
          ? "Could not find any peers for this torrent yet. It may be dead or very low on seeders."
          : "Could not start this torrent.",
      );
      return;
    }
    if (added.already_managed !== true) pendingEngineRef.current = added.info_hash;
    setEngine(added);
    const videos = added.files.filter(isVideoFile).sort((a, b) => b.length - a.length);
    if (videos.length === 0) {
      if (pendingEngineRef.current) {
        scheduleAbandonedTorrentRemoval(pendingEngineRef.current, 0);
        pendingEngineRef.current = null;
      }
      setMode("error");
      setError("No playable video file was found in this torrent.");
      return;
    }
    if (videos.length > 1) {
      setFiles(videos);
      setMode("picking");
      return;
    }
    void startPlay(videos[0].idx, videos[0].name, added);
  };

  const playButton = (
    <button
      type="button"
      onClick={onPlay}
      disabled={mode === "starting"}
      className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
    >
      {mode === "starting" ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Play size={18} fill="currentColor" />
      )}
      {mode === "starting" ? "Starting" : "Play"}
    </button>
  );

  if (mode === "picking") {
    return (
      <div className="flex flex-col gap-1.5 rounded-2xl border border-edge-soft bg-elevated/60 p-3">
        <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
          <FileVideo size={18} className="text-accent" />
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {files.length} playable files
          </span>
        </div>
        {files.map((f) => (
          <button
            key={f.idx}
            type="button"
            onClick={() => startPlay(f.idx, f.name)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-canvas/60"
          >
            <Play size={18} className="shrink-0 text-ink-muted" />
            <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{f.name}</span>
            <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">
              {formatSize(f.length)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (match) {
    const line = episodeLine(match) ?? match.meta.releaseInfo ?? "";
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/60 px-4 py-3.5">
        <div className="h-[64px] w-[44px] shrink-0 overflow-hidden rounded-lg shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
          <ResultPoster
            id={match.meta.id}
            poster={match.meta.poster}
            className="block h-full w-full"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold text-ink">{match.meta.name}</span>
          {line && <span className="truncate text-[12.5px] text-ink-muted">{line}</span>}
          {error && <span className="text-[12px] text-ink-subtle">{error}</span>}
        </div>
        {playButton}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
        <Magnet size={22} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          Torrent link
        </span>
        <span className="truncate text-[15px] font-semibold text-ink">{label}</span>
        <span className="truncate text-[12.5px] text-ink-subtle">
          {error ?? "Streams directly from peers over your own connection."}
        </span>
      </div>
      {playButton}
    </div>
  );
}

function episodeLine(m: MagnetMatch | null): string | undefined {
  if (!m || m.season == null || m.episode == null) return undefined;
  const base = `S${m.season} · E${m.episode}`;
  return m.episodeName ? `${base} · ${m.episodeName}` : base;
}

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickBestMeta(list: Meta[], title: string, year: number | null): Meta | null {
  const want = normTitle(title);
  if (!want) return null;
  let best: Meta | null = null;
  let bestScore = -1;
  for (const m of list) {
    const name = normTitle(m.name ?? "");
    if (!name) continue;
    let score = -1;
    if (name === want) score = 100;
    else if (name.startsWith(want) || want.startsWith(name)) score = 60;
    else if (name.includes(want) || want.includes(name)) score = 30;
    else continue;
    if (year && m.releaseInfo) {
      const my = releaseYear(m.releaseInfo);
      if (my === year) score += 20;
      else if (Number.isFinite(my) && Math.abs(my - year) <= 1) score += 8;
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

async function resolveMagnetMeta(dn: string): Promise<MagnetMatch | null> {
  const info = parse(dn);
  const title = (info.title ?? "").trim();
  if (title.length < 2) return null;
  const season = info.season ?? null;
  const episode = info.episode ?? null;
  const wantSeries = season != null && episode != null;
  const year = info.year ?? null;
  const { movies, series } = await searchCinemeta(title).catch(() => ({ movies: [], series: [] }));
  const best =
    pickBestMeta(wantSeries ? series : movies, title, year) ??
    pickBestMeta(wantSeries ? movies : series, title, year);
  if (!best) return null;
  const out: MagnetMatch = { meta: best, season, episode };
  if (wantSeries && /^tt\d+/.test(best.id)) {
    const full = await fetchMeta("series", best.id).catch(() => null);
    const vid = full?.videos?.find((v) => v.season === season && v.episode === episode);
    if (vid) {
      const epName = (vid.name ?? vid.title ?? "").trim();
      if (epName) out.episodeName = epName;
    }
  }
  return out;
}

function cleanReleaseName(dn: string | null): string {
  if (!dn) return "Magnet stream";
  const info = parse(dn);
  const title = (info.title ?? "").trim();
  if (title) {
    let line = title;
    if (info.season != null && info.episode != null)
      line += ` · S${info.season} · E${info.episode}`;
    else if (info.year) line += ` · ${info.year}`;
    if (info.resolution) line += ` · ${info.resolution}`;
    return line;
  }
  const stripped = dn
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return "Magnet stream";
  return stripped.length > 70 ? `${stripped.slice(0, 67).trimEnd()}…` : stripped;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}
