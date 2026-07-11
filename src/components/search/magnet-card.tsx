import { awaitCastServerReady } from "@/lib/stremio-server";
import { parseMagnet } from "@/lib/torrent/magnet";
import { buildTorrentStreamUrl, createAndListFiles, isVideoFile, type TorrentFile } from "@/lib/torrent/stremio-stream";
import { useView, type PlayerSrc } from "@/lib/view";
import { AlertCircle, FileVideo, Loader2, Magnet, Play } from "lucide-react";
import { useMemo, useState } from "react";

type Mode = "idle" | "starting" | "picking" | "error";

export function MagnetCard({ raw, onClose }: { raw: string; onClose: () => void }) {
  const { openPlayer } = useView();
  const parsed = useMemo(() => parseMagnet(raw), [raw]);
  const [mode, setMode] = useState<Mode>("idle");
  const [files, setFiles] = useState<TorrentFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!parsed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-edge-soft bg-elevated/60 px-5 py-4">
        <AlertCircle size={22} className="shrink-0 text-ink-subtle" />
        <span className="text-[14px] text-ink-muted">That does not look like a valid magnet link or infohash.</span>
      </div>
    );
  }

  const title = parsed.name ?? "Magnet stream";

  const startPlay = (fileIdx: number | null, name?: string) => {
    const src: PlayerSrc = {
      meta: { id: `magnet:${parsed.infoHash}`, type: "movie", name: title },
      url: buildTorrentStreamUrl({
        infoHash: parsed.infoHash,
        fileIdx,
        trackers: parsed.trackers,
        filename: name ?? null,
      }),
      title: name ?? title,
      streamRef: { infoHash: parsed.infoHash, fileIdx: fileIdx ?? null },
    };
    onClose();
    openPlayer(src);
  };

  const onPlay = async () => {
    setMode("starting");
    setError(null);
    const ready = await awaitCastServerReady(8000);
    if (!ready) {
      setMode("error");
      setError("The bundled streaming engine is not running. Direct torrent play needs the desktop app.");
      return;
    }
    const created = await createAndListFiles(parsed.infoHash, parsed.trackers);
    const videos = (created?.files ?? []).filter(isVideoFile).sort((a, b) => b.length - a.length);
    if (videos.length > 1) {
      setFiles(videos);
      setMode("picking");
      return;
    }
    startPlay(videos[0]?.idx ?? null, videos[0]?.name);
  };

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
            <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">{formatSize(f.length)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
        <Magnet size={22} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Torrent link</span>
        <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
        <span className="text-[12.5px] text-ink-subtle">
          {error ?? "Streams directly from peers over your own connection."}
        </span>
      </div>
      <button
        type="button"
        onClick={onPlay}
        disabled={mode === "starting"}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
      >
        {mode === "starting" ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
        {mode === "starting" ? "Starting" : "Play"}
      </button>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const gb = bytes / 1e9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}
