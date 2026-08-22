import { useMemo, useState } from "react";
import { Download as DownloadIcon } from "lucide-react";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useDownloads, type DownloadItem } from "@/lib/download/downloads-store";
import { StreamingNowButton } from "./downloads/streaming-now";
import { DownloadRow } from "./downloads/download-row";
import { SaveLocationChip } from "./downloads/save-location";
import { AutoDownloadButton, AutoDownloadModal } from "./downloads/auto-download-modal";
import { fmtBytes, fmtSpeed } from "./downloads/downloads-format";

type DownloadGroup =
  | { kind: "movie"; item: DownloadItem }
  | { kind: "show"; metaId: string; title: string; poster: string | null; items: DownloadItem[] };

type Filter = "all" | "active" | "saved" | "issues";

function statusRank(s: DownloadItem["status"]): number {
  return s === "downloading" ? 0 : s === "error" ? 1 : s === "done" ? 2 : 3;
}

function matchesFilter(d: DownloadItem, f: Filter): boolean {
  if (f === "active") return d.status === "downloading";
  if (f === "saved") return d.status === "done";
  if (f === "issues") return d.status === "error" || d.status === "interrupted";
  return true;
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

export function DownloadsView({ active = false }: { active?: boolean }) {
  const items = useDownloads();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((d) => matchesFilter(d, "active")).length,
      saved: items.filter((d) => matchesFilter(d, "saved")).length,
      issues: items.filter((d) => matchesFilter(d, "issues")).length,
    }),
    [items],
  );
  const effective: Filter = filter !== "all" && counts[filter] === 0 ? "all" : filter;

  const totalBps = items.reduce(
    (sum, d) => (d.status === "downloading" ? sum + d.bytesPerSec : sum),
    0,
  );
  const savedBytes = items.reduce(
    (sum, d) => (d.status === "done" ? sum + (d.totalBytes ?? d.receivedBytes) : sum),
    0,
  );
  const subtitle =
    items.length === 0
      ? "Saved movies and episodes for offline watching"
      : [
          `${items.length} item${items.length === 1 ? "" : "s"}`,
          counts.active > 0 ? `${counts.active} downloading` : null,
          totalBps > 0 ? `↓ ${fmtSpeed(totalBps)}` : null,
          savedBytes > 0 ? `${fmtBytes(savedBytes)} saved` : null,
        ]
          .filter(Boolean)
          .join("  ·  ");

  const groups = useMemo(
    () => buildGroups(items.filter((d) => matchesFilter(d, effective))),
    [items, effective],
  );

  return (
    <main className="flex-1 overflow-y-auto bg-canvas px-5 pb-24 pt-24 sm:px-8 lg:px-12 lg:pt-28">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">Downloads</h1>
            <p className="mt-1.5 text-[13.5px] tabular-nums text-ink-subtle">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StreamingNowButton active={active} />
            <AutoDownloadButton />
            <SaveLocationChip />
          </div>
        </header>

        {items.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            <FilterTab
              label="All"
              count={counts.all}
              active={effective === "all"}
              onClick={() => setFilter("all")}
            />
            {counts.active > 0 && (
              <FilterTab
                label="Downloading"
                count={counts.active}
                active={effective === "active"}
                onClick={() => setFilter("active")}
              />
            )}
            {counts.saved > 0 && (
              <FilterTab
                label="Saved"
                count={counts.saved}
                active={effective === "saved"}
                onClick={() => setFilter("saved")}
              />
            )}
            {counts.issues > 0 && (
              <FilterTab
                label="Issues"
                count={counts.issues}
                active={effective === "issues"}
                onClick={() => setFilter("issues")}
              />
            )}
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div key={effective} className="animate-fade-in flex flex-col gap-2.5">
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

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition duration-150 active:scale-[0.96] ${
        active
          ? "bg-ink text-canvas"
          : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft hover:bg-elevated hover:text-ink"
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? "text-canvas/70" : "text-ink-subtle"}`}>
        {count}
      </span>
    </button>
  );
}

function EmptyState() {
  const [autoOpen, setAutoOpen] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-edge-soft bg-elevated/30 px-8 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-ink-subtle">
        <DownloadIcon size={26} strokeWidth={1.8} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] font-semibold text-ink">No downloads yet</p>
        <p className="max-w-[340px] text-[13.5px] leading-relaxed text-ink-muted">
          Open any movie or show, hover an episode, and click the download icon. Pick the exact
          source you want and it saves here for offline watching.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setAutoOpen(true)}
        className="text-[13px] font-semibold text-accent transition duration-150 hover:opacity-85 active:scale-[0.97]"
      >
        Or set a series to auto-download
      </button>
      {autoOpen && <AutoDownloadModal onClose={() => setAutoOpen(false)} />}
    </div>
  );
}

function ShowGroup({ group }: { group: Extract<DownloadGroup, { kind: "show" }> }) {
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    group.metaId,
    group.poster ?? undefined,
    "series",
  );
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
          <span className="text-[11.5px] tabular-nums text-ink-subtle">
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
