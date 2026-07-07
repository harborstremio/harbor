import { useMemo, type ReactNode } from "react";
import { Check, Download as DownloadIcon, FolderOpen, Pause, Play, Trash2, X } from "lucide-react";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { DownloadDirBar } from "./downloads/download-dir-bar";
import {
  cancelDownload,
  pauseDownload,
  removeDownload,
  resumeDownload,
  revealDownload,
  useDownloads,
  type DownloadItem,
} from "@/lib/download/downloads-store";

function fmtBytes(n: number | null): string {
  if (n == null || n <= 0) return "";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

function fmtSpeed(bps: number): string {
  if (bps <= 0) return "";
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

function fmtEta(d: DownloadItem): string {
  if (d.bytesPerSec <= 0 || d.totalBytes == null) return "";
  const remain = d.totalBytes - d.receivedBytes;
  if (remain <= 0) return "";
  const secs = remain / d.bytesPerSec;
  if (secs >= 3600) return `${Math.round(secs / 3600)}h left`;
  if (secs >= 60) return `${Math.round(secs / 60)}m left`;
  return `${Math.round(secs)}s left`;
}

type DownloadGroup =
  | { kind: "movie"; item: DownloadItem }
  | { kind: "show"; metaId: string; title: string; poster: string | null; items: DownloadItem[] };

function statusRank(s: DownloadItem["status"]): number {
  return s === "downloading" ? 0 : s === "error" ? 1 : s === "done" ? 2 : 3;
}

function buildGroups(items: DownloadItem[]): DownloadGroup[] {
  const shows = new Map<string, DownloadItem[]>();
  const movies: DownloadItem[] = [];
  for (const d of items) {
    if (d.season != null) {
      const arr = shows.get(d.metaId);
      if (arr) arr.push(d);
      else shows.set(d.metaId, [d]);
    } else {
      movies.push(d);
    }
  }
  const groups: DownloadGroup[] = movies.map((item) => ({ kind: "movie", item }));
  for (const [metaId, arr] of shows) {
    groups.push({ kind: "show", metaId, title: arr[0].title, poster: arr[0].poster, items: arr });
  }
  const keyOf = (g: DownloadGroup) => {
    const its = g.kind === "movie" ? [g.item] : g.items;
    return {
      best: Math.min(...its.map((d) => statusRank(d.status))),
      recent: Math.max(...its.map((d) => d.startedAt)),
    };
  };
  return groups.sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    return ka.best - kb.best || kb.recent - ka.recent;
  });
}

export function DownloadsView() {
  const items = useDownloads();
  const active = items.filter((d) => d.status === "downloading").length;
  const savedBytes = items.reduce(
    (sum, d) => (d.status === "done" ? sum + (d.totalBytes ?? d.receivedBytes) : sum),
    0,
  );
  const groups = useMemo(() => buildGroups(items), [items]);

  return (
    <main className="flex-1 overflow-y-auto bg-canvas px-5 pb-24 pt-24 sm:px-8 lg:px-12 lg:pt-28">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Downloads</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-subtle">
            {items.length === 0
              ? "Saved movies and episodes for offline watching"
              : [
                  `${items.length} item${items.length === 1 ? "" : "s"}`,
                  active > 0 ? `${active} downloading` : null,
                  savedBytes > 0 ? `${fmtBytes(savedBytes)} saved` : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
          </p>
        </header>

        <DownloadDirBar />

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-2.5">
            {groups.map((g) =>
              g.kind === "movie" ? (
                <ul key={g.item.id} className="contents">
                  <DownloadRow d={g.item} />
                </ul>
              ) : (
                <ShowGroup key={g.metaId} group={g} />
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-edge-soft bg-elevated/30 px-8 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-ink-subtle">
        <DownloadIcon size={26} strokeWidth={1.8} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-ink">No downloads yet</p>
        <p className="max-w-[340px] text-[13.5px] leading-relaxed text-ink-muted">
          Open any movie or show, hover an episode, and click the download icon. Pick the exact source you want and it saves here for offline watching.
        </p>
      </div>
    </div>
  );
}

function ShowGroup({ group }: { group: Extract<DownloadGroup, { kind: "show" }> }) {
  const { settings } = useSettings();
  const poster = usePosterChain(settings.rpdbKey, group.metaId, group.poster ?? undefined, "series");
  const episodes = useMemo(
    () =>
      [...group.items].sort(
        (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0),
      ),
    [group.items],
  );
  const totalBytes = episodes.reduce(
    (sum, d) => (d.status === "done" ? sum + (d.totalBytes ?? d.receivedBytes) : sum),
    0,
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-edge-soft bg-elevated/25">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="h-[52px] w-[36px] shrink-0 overflow-hidden rounded-md">
          <Poster src={poster.src} onError={poster.onError} seed={group.metaId} ratio="portrait" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-semibold text-ink">{group.title}</span>
          <span className="text-[11.5px] text-ink-subtle">
            {episodes.length} episode{episodes.length === 1 ? "" : "s"}
            {totalBytes > 0 ? `  ·  ${fmtBytes(totalBytes)}` : ""}
          </span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 border-t border-edge-soft/50 px-2 pb-2 pt-2">
        {episodes.map((d) => (
          <DownloadRow key={d.id} d={d} compact />
        ))}
      </ul>
    </div>
  );
}

function DownloadRow({ d, compact = false }: { d: DownloadItem; compact?: boolean }) {
  const { openPlayer } = useView();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    d.metaId,
    d.poster ?? undefined,
    d.season != null ? "series" : "movie",
  );
  const pct = Math.round(d.ratio * 100);
  const playLocal = () =>
    openPlayer({
      meta: {
        id: d.metaId,
        type: d.season != null ? "series" : "movie",
        name: d.title,
        poster: d.poster ?? undefined,
      },
      url: d.path,
      title: d.title,
      subtitle: d.subtitle ?? undefined,
      notWebReady: true,
      episode:
        d.season != null && d.episode != null
          ? { season: d.season, episode: d.episode }
          : undefined,
    });
  return (
    <li className="group flex items-center gap-4 rounded-2xl border border-edge-soft bg-elevated/40 p-3 transition-colors hover:bg-elevated/70">
      <div
        className={`${compact ? "h-[44px] w-[30px]" : "h-[68px] w-[46px]"} shrink-0 overflow-hidden rounded-lg`}
      >
        <Poster src={poster.src} onError={poster.onError} seed={d.metaId} ratio="portrait" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold text-ink">
            {compact ? (d.subtitle ?? d.title) : d.title}
          </span>
          {!compact && d.subtitle && (
            <span className="shrink-0 truncate text-[12px] text-ink-subtle">{d.subtitle}</span>
          )}
        </div>
        {d.status === "downloading" || d.status === "paused" ? (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-ink-muted">
              {d.status === "paused" ? (
                <span className="text-amber-300/85">Paused</span>
              ) : (
                <>
                  <span>{pct}%</span>
                  {d.totalBytes != null && (
                    <span className="text-ink-subtle">
                      {fmtBytes(d.receivedBytes)} / {fmtBytes(d.totalBytes)}
                    </span>
                  )}
                  {fmtSpeed(d.bytesPerSec) && <span>· {fmtSpeed(d.bytesPerSec)}</span>}
                  {fmtEta(d) && <span className="text-ink-subtle">· {fmtEta(d)}</span>}
                </>
              )}
            </div>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-[12px]">
            {d.status === "done" && (
              <>
                <Check size={13} className="text-accent" strokeWidth={2.6} />
                <span className="text-ink-muted">
                  Saved{d.streamLabel ? ` · ${d.streamLabel}` : ""}
                  {d.totalBytes ? ` · ${fmtBytes(d.totalBytes)}` : ""}
                </span>
              </>
            )}
            {d.status === "error" && <span className="text-danger">Failed: {d.error ?? "download error"}</span>}
            {d.status === "canceled" && <span className="text-ink-subtle">Canceled</span>}
            {d.status === "interrupted" && (
              <span className="text-amber-300/85">Interrupted: re-download to finish</span>
            )}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {d.status === "downloading" && (
          <>
            <RowBtn label="Pause download" onClick={() => pauseDownload(d.id)}>
              <Pause size={16} strokeWidth={2.2} />
            </RowBtn>
            <RowBtn label="Cancel download" onClick={() => cancelDownload(d.id)}>
              <X size={16} strokeWidth={2.2} />
            </RowBtn>
          </>
        )}
        {d.status === "paused" && (
          <>
            <RowBtn label="Resume download" onClick={() => void resumeDownload(d.id)}>
              <Play size={16} strokeWidth={2.2} />
            </RowBtn>
            <RowBtn label="Cancel download" onClick={() => cancelDownload(d.id)}>
              <X size={16} strokeWidth={2.2} />
            </RowBtn>
          </>
        )}
        {d.status === "done" && (
          <>
            <RowBtn label="Play" onClick={playLocal}>
              <Play size={16} strokeWidth={2.2} fill="currentColor" />
            </RowBtn>
            <RowBtn label="Show in folder" onClick={() => void revealDownload(d.id)}>
              <FolderOpen size={16} strokeWidth={2} />
            </RowBtn>
            <RowBtn label="Delete download and file" onClick={() => removeDownload(d.id)}>
              <Trash2 size={16} strokeWidth={2} />
            </RowBtn>
          </>
        )}
        {(d.status === "canceled" || d.status === "error" || d.status === "interrupted") && (
          <RowBtn label="Delete download and file" onClick={() => removeDownload(d.id)}>
            <Trash2 size={16} strokeWidth={2} />
          </RowBtn>
        )}
      </div>
    </li>
  );
}

function RowBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-ink/10 hover:text-ink"
    >
      {children}
    </button>
  );
}
